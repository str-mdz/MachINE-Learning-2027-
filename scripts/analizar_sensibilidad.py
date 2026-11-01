import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from scripts.estimar_ml import DATA, DEMO, STATES, json_bytes, load_inputs
from src.horizonte2027.prediccion import FEATURES, build_features, ridge_predict

OUTPUT = DATA / 'sensibilidad_ridge.json'


def analyze(states, demo, metadata):
    fit = metadata['entrenamiento_final']
    features = build_features(states, demo, future_year=2027)
    current = features.loc[features.anio.eq(2027)]
    records = []
    for _, row in current.iterrows():
        entity = row.entidad_clave
        prior = features.loc[features.entidad_clave.eq(entity)]
        prediction = float(ridge_predict(fit, row.to_frame().T)[0])
        published = float(np.clip(prediction, 0, 100))
        variables = []
        for i, name in enumerate(FEATURES):
            if name == 'presidencial':
                continue
            observed = prior.loc[prior.presidencial.eq(0)] if name == 'brecha_previa_pp' else prior
            low, high = float(observed[name].min()), float(observed[name].max())
            if name.startswith('prop_') or name == 'ns_previo':
                low, high = max(0, low), min(1, high)
            if name in ['prop_joven_previa', 'prop_mayor_previa']:
                other = 'prop_mayor_previa' if name == 'prop_joven_previa' else 'prop_joven_previa'
                high = min(high, 1 - float(row[other]))
            values = []
            for value in [low, high]:
                varied = row.to_frame().T.copy()
                varied[name] = value
                raw = float(ridge_predict(fit, varied)[0])
                result = float(np.clip(raw, 0, 100))
                values.append(dict(entrada=value, estimacion_pct=result, cambio_pp=result-published,
                                   sin_limitar_pct=raw, limitada=raw != result))
            variables.append(dict(variable=name, entrada_original=float(row[name]), minimo=low, maximo=high,
                                  anios_fuente=sorted(int(v) for v in observed.max_anio_fuente.unique()),
                                  n_observaciones=len(observed), extremos=values,
                                  amplitud_pp=abs(values[1]['estimacion_pct']-values[0]['estimacion_pct']),
                                  max_cambio_absoluto_pp=max(abs(v['cambio_pp']) for v in values)))
        records.append(dict(entidad_clave=entity, entidad_nombre=row.entidad_nombre,
                            original_pct=published, original_sin_limitar_pct=prediction,
                            variables=sorted(variables, key=lambda v: -v['amplitud_pp'])))
    return dict(metodo='Una variable a la vez; modelo publicado fijo, alpha=10, lambda=1; presidencial=0.',
                rango='Mínimo y máximo de entradas históricas de la propia entidad disponibles hasta 2024. Brecha: solo referencias de tipo intermedio. No son resultados observados de 2027.',
                medida='Amplitud en puntos porcentuales entre los dos extremos; también se informa el cambio respecto a la estimación original.',
                restricciones='Proporciones entre 0 y 1, jóvenes + mayores <= 1. Lista nominal en escala logarítmica del entrenamiento. Salidas limitadas a 0–100.',
                limitacion='Combinaciones sintéticas: aun dentro de rangos históricos, variar una sola entrada rompe asociaciones entre variables. No se garantiza plausibilidad conjunta. No son causas, predicciones alternativas validadas ni intervalos de confianza.',
                registros=records)


def artifact():
    model = DATA / 'modelo_ridge.json'
    metadata = json.loads(model.read_text(encoding='utf-8'))
    result = analyze(*load_inputs(), metadata)
    result['fuentes_sha256'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [STATES, DEMO, model]}
    result['codigo_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return json_bytes(result)


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--publicar', action='store_true')
    group.add_argument('--verificar', action='store_true')
    args = parser.parse_args()
    content = artifact()
    if args.publicar:
        OUTPUT.write_bytes(content)
    if OUTPUT.read_bytes() != content:
        raise ValueError('Sensibilidad publicada no reproducible')


if __name__ == '__main__':
    main()
