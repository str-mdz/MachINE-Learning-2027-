import argparse
import hashlib
import json
import platform
from pathlib import Path

import numpy as np
import pandas as pd

from scripts.estimar_ml import DEMO, STATES, json_bytes, load_inputs
from src.horizonte2027.prediccion import FEATURES, build_features, fit_ridge, ridge_predict

OUTPUT = Path(__file__).resolve().parents[1] / 'frontend/src/data/evaluacion_ridge.json'
ALPHAS = [1, 10, 100]
LAMBDAS = [0, 0.25, 0.5, 0.75, 1]


def evaluate(states, demo):
    features = build_features(states, demo)
    summary, errors, folds = [], [], {}
    for year in [2021, 2024]:
        train = features.loc[features.anio < year]
        test = features.loc[features.anio == year]
        baseline = test.abstencion_mismo_tipo_pp.to_numpy()
        target = test.objetivo_abstencion_pp.to_numpy()
        reference_mae = float(np.abs(baseline - target).mean())
        fits = {}
        for alpha in ALPHAS:
            fit = fit_ridge(train, alpha=alpha)
            fits[str(alpha)] = fit
            residual = ridge_predict(fit, test) - baseline
            for intensity in LAMBDAS:
                raw = baseline + intensity * residual
                prediction = np.clip(raw, 0, 100)
                error = prediction - target
                label = f'a{alpha}_l{intensity:g}'
                summary.append(dict(configuracion=label, alpha=alpha, intensidad=intensity, anio=year,
                                    tipo_eleccion='intermedia' if year == 2021 else 'presidencial',
                                    n=32, mae_pp=float(np.abs(error).mean()), rmse_pp=float(np.sqrt(np.mean(error ** 2))),
                                    diferencia_mae_referencia_pp=float(np.abs(error).mean()) - reference_mae,
                                    limitadas=int(np.sum(raw != prediction))))
                for row, value, delta in zip(test.itertuples(), prediction, error):
                    errors.append(dict(configuracion=label, anio=year, entidad_clave=row.entidad_clave,
                                       observado_pct=float(row.objetivo_abstencion_pp), prediccion_pct=float(value),
                                       error_pp=float(delta), error_absoluto_pp=float(abs(delta))))
        folds[str(year)] = dict(anios_entrenamiento=sorted(int(x) for x in train.anio.unique()),
                               n_entrenamiento=len(train), max_anio_fuente=int(test.max_anio_fuente.max()), ajustes=fits)
    development = [r for r in summary if r['anio'] == 2021]
    candidate = min(development, key=lambda r: (r['mae_pp'], abs(r['alpha'] - 10), abs(r['intensidad'] - 1)))
    comparison = min((r for r in summary if r['anio'] == 2024), key=lambda r: r['mae_pp'])
    original = next(r for r in development if r['alpha'] == 10 and r['intensidad'] == 1)
    stability = [dict(configuracion=r['configuracion'], variacion_mae_pp=abs(r['mae_pp'] - next(
        x['mae_pp'] for x in summary if x['anio'] == 2024 and x['configuracion'] == r['configuracion']))) for r in development]
    train = features.loc[features.anio < 2021, FEATURES]
    correlations = train.corr()
    pairs = [dict(variable_a=a, variable_b=b, correlacion=float(correlations.loc[a, b]))
             for i, a in enumerate(FEATURES) for b in FEATURES[i + 1:]
             if np.isfinite(correlations.loc[a, b]) and abs(correlations.loc[a, b]) >= 0.8]
    standardized = (train - train.mean()) / train.std(ddof=0).replace(0, 1)
    return dict(protocolo=dict(alphas=ALPHAS, lambdas=LAMBDAS, features=FEATURES,
                               regla_limites='clip(0,100) después de referencia + lambda * residual; se contabilizan los recortes',
                               seleccion='Menor MAE en 2021; desempate por cercanía a alpha=10, lambda=1. No utiliza 2024.',
                               margen_relevancia_descriptivo_pp=0.5,
                               corte_2018='No válido bajo el protocolo: solo 2015 como objetivo de entrenamiento, sin tipo presidencial representado.',
                               independencia='2021 y 2024 ya fueron examinados. No existe un nuevo corte independiente para confirmar la selección.'),
                resultados=summary, errores_por_entidad=errors, folds=folds, estabilidad=stability,
                diagnostico=dict(n_entrenamiento_pre2021=len(train), rango_caracteristicas_estandarizadas=int(np.linalg.matrix_rank(standardized.to_numpy())),
                                 numero_condicion=float(np.linalg.cond(standardized.to_numpy())), correlaciones_altas=pairs,
                                 conclusion='Se conservan las siete variables: no se seleccionan características con los errores de 2024.'),
                decision=dict(configuracion_operativa='a10_l1', alpha=10, intensidad=1, conservar_original=True,
                              candidato_seleccionado_2021=candidate['configuracion'],
                              mejora_candidato_mae_2021_pp=original['mae_pp'] - candidate['mae_pp'],
                              minimo_exploratorio_2024=comparison['configuracion'],
                              motivo='Un único corte de selección y una comparación presidencial ya conocida no demuestran generalización. Se conserva Ridge original; las variantes son complementarias y retrospectivas.'))


def artifact():
    result = evaluate(*load_inputs())
    result['fuentes_sha256'] = {str(p.relative_to(OUTPUT.parents[3])).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in [STATES, DEMO]}
    result['versiones'] = dict(python=platform.python_version(), numpy=np.__version__, pandas=pd.__version__)
    result['codigo_prediccion_sha256'] = hashlib.sha256((OUTPUT.parents[3] / 'src/horizonte2027/prediccion.py').read_bytes()).hexdigest()
    result['codigo_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return json_bytes(result)


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--publicar', action='store_true')
    group.add_argument('--verificar', action='store_true')
    args = parser.parse_args()
    content = artifact()
    if content != artifact():
        raise ValueError('Evaluación no reproducible')
    if args.publicar:
        OUTPUT.write_bytes(content)
    if (args.verificar or args.publicar) and OUTPUT.read_bytes() != content:
        raise ValueError('La evaluación publicada no coincide')
    result = json.loads(content)
    print(json.dumps(dict(decision=result['decision'], resultados=result['resultados'], diagnostico=result['diagnostico']), ensure_ascii=True))


if __name__ == '__main__':
    main()
