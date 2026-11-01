import argparse
import hashlib
import json
import platform
from pathlib import Path

import numpy as np
import pandas as pd

from src.horizonte2027.prediccion import FEATURES, build_features, fit_ridge, metrics, predict_fold, ridge_predict

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'frontend/src/data'
STATES = ROOT / 'Data/processed/participacion_estatal.csv'
DEMO = ROOT / 'frontend/public/data/resumen_demografico.json'


def digest(content):
    return hashlib.sha256(content).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + '\n').encode('utf-8')


def load_inputs():
    states = pd.read_csv(STATES, dtype={'entidad_clave': str})
    demo = pd.DataFrame(json.loads(DEMO.read_text(encoding='utf-8'))['registros'])
    keys = ['anio', 'entidad_clave']
    counts = ['lista_nominal', 'si_votaron', 'no_votaron', 'no_especificados']
    if len(states) != 192 or states.duplicated(keys).any():
        raise ValueError('Se requieren 192 observaciones estatales únicas')
    if set(states.anio) != {2009, 2012, 2015, 2018, 2021, 2024}:
        raise ValueError('Serie histórica incompleta')
    expected = {f'{i:02}' for i in range(1, 33)}
    if any(set(group.entidad_clave) != expected for _, group in states.groupby('anio')):
        raise ValueError('Cobertura histórica inválida')
    if (states[counts] < 0).any().any() or not states.lista_nominal.eq(states[counts[1:]].sum(axis=1)).all():
        raise ValueError('Conteos inválidos')
    if not states.conocidos.eq(states.si_votaron + states.no_votaron).all() or (states.conocidos <= 0).any():
        raise ValueError('Denominadores inválidos')
    if not demo.groupby(keys)[counts].sum().sort_index().equals(states.set_index(keys)[counts].sort_index()):
        raise ValueError('Los agregados demográficos no coinciden con los estatales')
    return states, demo


def estimate(states, demo):
    features = build_features(states, demo, future_year=2027)
    observed = features.loc[features.anio <= 2024]
    folds, fits = [], {}
    for year in [2021, 2024]:
        predictions, fold = predict_fold(observed, states, year)
        folds.append(predictions)
        fits[str(year)] = fold
    errors = pd.concat(folds, ignore_index=True)
    scores = metrics(errors)
    fit = fit_ridge(observed, alpha=10.0)
    future = features.loc[features.anio == 2027].copy()
    raw = ridge_predict(fit, future)
    prediction = np.clip(raw, 0, 100)
    previous = states.loc[states.anio == 2021].set_index('entidad_clave').loc[future.entidad_clave]
    baseline = future.abstencion_mismo_tipo_pp.to_numpy()
    projection = pd.DataFrame({
        'entidad_clave': future.entidad_clave.to_numpy(),
        'entidad_nombre': future.entidad_nombre.to_numpy(),
        'anio_proyeccion': 2027, 'tipo_eleccion': 'intermedia', 'anio_fuente': 2024,
        'metodo': 'ridge_residual', 'abstencion_2021_pct': baseline,
        'abstencion_referencia_pct': prediction,
        'participacion_referencia_pct': 100 - prediction,
        'residual_estimado_pp': raw - baseline,
        'prediccion_sin_limitar_pct': raw,
        'diferencia_2021_2027_pp': prediction - baseline,
        'limitada_0_100': raw != prediction,
        'conocidos_2021': previous.conocidos.to_numpy(),
        'peso_nacional': previous.conocidos.to_numpy() / previous.conocidos.sum(),
        'no_especificados_2021': previous.no_especificados.to_numpy(),
    })
    cuts = np.quantile(prediction, [1 / 3, 2 / 3], method='linear')
    risk = projection[['entidad_clave', 'entidad_nombre', 'anio_proyeccion', 'abstencion_referencia_pct']].copy()
    risk['riesgo_relativo'] = np.where(prediction <= cuts[0], 'bajo', np.where(prediction <= cuts[1], 'medio', 'alto'))
    risk['umbral_bajo_pct'], risk['umbral_medio_pct'] = cuts
    risk['criterio'] = 'terciles_estatales_ridge_2027_lineal'
    scenarios, nationals = [], []
    for reduction in [0, 1, 3, 5]:
        table = projection.copy()
        table['escenario'] = 'sin_intervencion' if reduction == 0 else 'con_intervencion'
        table['reduccion_supuesta_pp'] = reduction
        table['abstencion_escenario_pct'] = np.clip(prediction - reduction, 0, 100)
        table['participacion_escenario_pct'] = 100 - table.abstencion_escenario_pct
        table['reduccion_efectiva_pp'] = prediction - table.abstencion_escenario_pct
        table['limitado_en_cero'] = prediction < reduction
        scenarios.append(table)
        value = float(np.average(table.abstencion_escenario_pct, weights=table.conocidos_2021))
        nationals.append(dict(escenario=table.escenario.iloc[0], reduccion_supuesta_pp=reduction,
                              abstencion_nacional_pct=value, participacion_nacional_pct=100 - value,
                              reduccion_nacional_efectiva_pp=float(np.average(prediction, weights=table.conocidos_2021)) - value,
                              denominador_conocidos_2021=int(previous.conocidos.sum()), anio_ponderacion=2021,
                              entidades=32, entidades_limitadas=int(table.limitado_en_cero.sum())))
    tables = dict(proyeccion_2027=projection, semaforo_territorial=risk,
                  escenarios_2027=pd.concat(scenarios, ignore_index=True),
                  resumen_nacional=pd.DataFrame(nationals), comparacion_modelos=scores)
    metadata = dict(metodo='ridge_residual', experimental=True, objetivo='100 * NV / (SV + NV)',
                    features=FEATURES, alpha=10.0, seleccion_alpha='Fijo, heredado del protocolo anterior; sin ajuste con 2024',
                    regla_limites='clip(0, 100) en backtest, proyección y escenarios; se conserva predicción sin limitar',
                    anio_ponderacion=2021, versiones=dict(python=platform.python_version(), numpy=np.__version__, pandas=pd.__version__),
                    fuentes={str(p.relative_to(ROOT)).replace('\\', '/'): digest(p.read_bytes()) for p in [STATES, DEMO]},
                    codigo_sha256={str(p.relative_to(ROOT)).replace('\\', '/'): digest(p.read_bytes()) for p in [Path(__file__).resolve(), ROOT / 'src/horizonte2027/prediccion.py']},
                    entrenamiento_final=fit, evaluaciones=fits,
                    errores_por_entidad=errors.to_dict(orient='records'),
                    caracteristicas_2027=future.drop(columns=['objetivo_abstencion_pp']).to_dict(orient='records'))
    validate(tables, metadata)
    return tables, metadata


def validate(tables, metadata):
    p = tables['proyeccion_2027']
    if len(p) != 32 or p.entidad_clave.nunique() != 32 or p.isna().any().any():
        raise ValueError('Proyección incompleta')
    if not p.abstencion_referencia_pct.between(0, 100).all():
        raise ValueError('Predicción fuera de límites')
    if not np.allclose(p.abstencion_referencia_pct - p.abstencion_2021_pct, p.diferencia_2021_2027_pp):
        raise ValueError('Comparación histórica inconsistente')
    future = pd.DataFrame(metadata['caracteristicas_2027'])
    if not future.max_anio_fuente.eq(2024).all() or not future.anio_mismo_tipo.eq(2021).all():
        raise ValueError('Fuentes futuras o tipo de elección incorrecto')
    raw = ridge_predict(metadata['entrenamiento_final'], future)
    np.testing.assert_allclose(raw, p.prediccion_sin_limitar_pct, rtol=0, atol=1e-10)
    for year, fold in metadata['evaluaciones'].items():
        if max(fold['ridge']['train_years']) >= int(year):
            raise ValueError('Fuga temporal en entrenamiento')
    for reduction, group in tables['escenarios_2027'].groupby('reduccion_supuesta_pp'):
        if len(group) != 32 or group.entidad_clave.nunique() != 32:
            raise ValueError('Escenario incompleto')
        np.testing.assert_allclose(group.abstencion_escenario_pct, np.clip(p.abstencion_referencia_pct - reduction, 0, 100))
        national = tables['resumen_nacional'].set_index('reduccion_supuesta_pp').loc[reduction]
        np.testing.assert_allclose(national.abstencion_nacional_pct, np.average(group.abstencion_escenario_pct, weights=group.conocidos_2021))


def artifacts(tables, metadata):
    output = {DATA / 'modelo_ridge.json': json_bytes(metadata)}
    for name, frame in tables.items():
        folder = 'fase3' if name == 'comparacion_modelos' else 'fase4'
        csv_path = ROOT / f'results/tables/{folder}/{name}.csv'
        rounded = frame.round(10)
        csv_content = rounded.to_csv(index=False, lineterminator='\n', float_format='%.10f').encode('utf-8')
        units = {column: ('puntos_porcentuales' if column.endswith('_pp') else
                          'porcentaje_0_100' if column.endswith('_pct') else
                          'proporcion_0_1' if column == 'peso_nacional' else 'ver_nombre_y_diccionario') for column in rounded}
        units['entidad_clave'] = 'clave_texto_2_digitos' if 'entidad_clave' in rounded else units.get('entidad_clave', '')
        if 'entidad_clave' not in rounded:
            units.pop('entidad_clave')
        envelope = dict(schema_version='1.0', tabla=name, fuente_csv=csv_path.relative_to(ROOT).as_posix(),
                        fuente_sha256=digest(csv_content), filas=len(rounded), unidades=units,
                        registros=rounded.to_dict(orient='records'))
        output[csv_path] = csv_content
        output[DATA / f'{name}.json'] = json_bytes(envelope)
        properties = {}
        for column in rounded:
            dtype = rounded[column].dtype
            properties[column] = {'type': 'boolean' if pd.api.types.is_bool_dtype(dtype) else
                                  'integer' if pd.api.types.is_integer_dtype(dtype) else
                                  'number' if pd.api.types.is_float_dtype(dtype) else 'string'}
            if column == 'entidad_clave':
                properties[column]['pattern'] = '^(0[1-9]|[12][0-9]|3[0-2])$'
            if column.endswith('_pct') or column in ['reduccion_supuesta_pp', 'reduccion_efectiva_pp', 'reduccion_nacional_efectiva_pp']:
                if column != 'prediccion_sin_limitar_pct':
                    properties[column].update(minimum=0, maximum=100)
            if column == 'peso_nacional':
                properties[column].update(minimum=0, maximum=1)
            if properties[column]['type'] == 'integer':
                properties[column].update(minimum=0, maximum=9007199254740991)
            if column in ['mae_pp', 'rmse_pp', 'mediana_error_abs_pp', 'p90_error_abs_pp', 'max_error_abs_pp']:
                properties[column]['minimum'] = 0
            if column in ['anio_proyeccion', 'anio_fuente', 'anio_ponderacion', 'metodo', 'tipo_eleccion']:
                if rounded[column].nunique() == 1:
                    properties[column]['const'] = rounded[column].iloc[0].item() if hasattr(rounded[column].iloc[0], 'item') else rounded[column].iloc[0]
            if column == 'riesgo_relativo':
                properties[column]['enum'] = ['bajo', 'medio', 'alto']
            if column == 'escenario':
                properties[column]['enum'] = ['sin_intervencion', 'con_intervencion']
            if column == 'reduccion_supuesta_pp':
                properties[column]['enum'] = [0, 1, 3, 5]
        schema = {'$schema': 'https://json-schema.org/draft/2020-12/schema', 'type': 'object',
                  'required': list(envelope), 'additionalProperties': False,
                  'properties': {key: {'const': envelope[key]} for key in ['schema_version', 'tabla', 'unidades']}}
        schema['properties'].update(fuente_csv={'type': 'string'}, fuente_sha256={'type': 'string', 'pattern': '^[a-f0-9]{64}$'},
                                     filas={'type': 'integer', 'minimum': 0},
                                     registros={'type': 'array', 'items': {'type': 'object', 'required': list(properties),
                                                                        'additionalProperties': False, 'properties': properties}})
        output[DATA / f'{name}.schema.json'] = json_bytes(schema)
    manifest_path = DATA / 'procedencia.json'
    entries = json.loads(manifest_path.read_text(encoding='utf-8'))
    for path in sorted(output):
        if path.parent == DATA and path.name != 'modelo_ridge.json':
            entry = next((item for item in entries if item['archivo'] == path.name), None)
            if entry is None:
                entry = {'archivo': path.name}
                entries.append(entry)
            entry.update(origen=path.relative_to(ROOT).as_posix(), sha256=digest(output[path]))
    output[manifest_path] = json_bytes(entries)
    return output


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--publicar', action='store_true')
    group.add_argument('--verificar', action='store_true')
    args = parser.parse_args()
    states, demo = load_inputs()
    tables, metadata = estimate(states, demo)
    repeated, repeated_meta = estimate(states, demo)
    if json_bytes(metadata) != json_bytes(repeated_meta):
        raise ValueError('Entrenamiento no reproducible')
    for name in tables:
        pd.testing.assert_frame_equal(tables[name], repeated[name], check_exact=True)
    output = artifacts(tables, metadata)
    if args.publicar:
        for path in output:
            if not path.parent.is_dir():
                raise ValueError(f'Falta directorio existente: {path.parent}')
        for path, content in output.items():
            path.write_bytes(content)
    if args.verificar or args.publicar:
        for path, content in output.items():
            if path.read_bytes() != content:
                raise ValueError(f'Archivo no reproducible: {path.relative_to(ROOT)}')
    print(json.dumps(dict(metricas=tables['comparacion_modelos'].to_dict(orient='records'),
                          escenarios_nacionales=tables['resumen_nacional'].to_dict(orient='records'),
                          umbrales=tables['semaforo_territorial'][['umbral_bajo_pct', 'umbral_medio_pct']].iloc[0].to_dict(),
                          niveles=tables['semaforo_territorial'].riesgo_relativo.value_counts().to_dict()), ensure_ascii=True))


if __name__ == '__main__':
    main()
