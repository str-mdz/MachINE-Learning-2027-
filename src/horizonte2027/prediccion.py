import numpy as np
import pandas as pd

PRESIDENTIAL = {2012, 2018, 2024}
INTERMEDIATE = {2009, 2015, 2021, 2027}
FEATURES = ['brecha_previa_pp', 'presidencial', 'ns_previo', 'log_ln_previa',
            'prop_joven_previa', 'prop_mayor_previa', 'prop_mujeres_previa']
MODELS = ['ultima_eleccion', 'mismo_tipo', 'ultimo_ajustado_tipo', 'ridge_residual']


def election_type(year):
    if year in PRESIDENTIAL:
        return 'presidencial'
    if year in INTERMEDIATE:
        return 'intermedia'
    raise ValueError(f'Año fuera del protocolo: {year}')


def demographic_features(demo):
    data = demo.copy()
    for name, mask in [('prop_joven_previa', data.edad.between(18, 29)),
                       ('prop_mayor_previa', data.edad.between(60, 120)),
                       ('prop_mujeres_previa', data.sexo_codigo.eq(1))]:
        data[name] = data.lista_nominal.where(mask.fillna(False), 0)
    columns = ['lista_nominal', 'prop_joven_previa', 'prop_mayor_previa', 'prop_mujeres_previa']
    sums = data.groupby(['anio', 'entidad_clave'])[columns].sum()
    if (sums.lista_nominal <= 0).any():
        raise ValueError('No hay denominador demográfico válido')
    for name in columns[1:]:
        sums[name] = sums[name] / sums.lista_nominal
    return sums[columns[1:]]


def build_features(states, demo, future_year=None):
    history = states.copy().sort_values(['entidad_clave', 'anio'])
    history['abstencion_pp'] = 100 * history.no_votaron / (history.si_votaron + history.no_votaron)
    demographics = demographic_features(demo)
    records = []
    for entity, group in history.groupby('entidad_clave'):
        targets = [(int(row.anio), float(row.abstencion_pp), row.entidad_nombre)
                   for row in group.itertuples()]
        if future_year is not None:
            if future_year <= history.anio.max():
                raise ValueError('El año futuro debe ser posterior a los datos observados')
            targets.append((future_year, None, group.entidad_nombre.iloc[-1]))
        for year, objective, name in targets:
            past = group.loc[group.anio < year]
            same = past.loc[past.anio.map(election_type).eq(election_type(year))]
            if past.empty or same.empty:
                continue
            last = past.iloc[-1]
            last_same = same.iloc[-1]
            previous_demo = demographics.loc[(last.anio, entity)]
            records.append(dict(anio=year, entidad_clave=entity, entidad_nombre=name,
                                tipo_eleccion=election_type(year), objetivo_abstencion_pp=objective,
                                anio_ultimo=int(last.anio), anio_mismo_tipo=int(last_same.anio),
                                max_anio_fuente=int(last.anio),
                                abstencion_ultimo_pp=float(last.abstencion_pp),
                                abstencion_mismo_tipo_pp=float(last_same.abstencion_pp),
                                brecha_previa_pp=float(last.abstencion_pp - last_same.abstencion_pp),
                                presidencial=int(year in PRESIDENTIAL),
                                ns_previo=float(last.no_especificados / last.lista_nominal),
                                log_ln_previa=float(np.log(last.lista_nominal)),
                                **previous_demo.to_dict()))
    frame = pd.DataFrame(records).sort_values(['anio', 'entidad_clave']).reset_index(drop=True)
    if not frame.max_anio_fuente.lt(frame.anio).all():
        raise ValueError('Fuga temporal en características')
    if (not np.isfinite(frame[FEATURES].to_numpy(dtype=float)).all() or
            not np.isfinite(frame.loc[frame.anio.ne(future_year), 'objetivo_abstencion_pp']).all()):
        raise ValueError('Variables incompletas; no se imputan automáticamente')
    return frame


def historical_type_shift(states, target_year):
    """Promedio de transiciones ya observadas del tipo que se desea predecir."""
    history = states.loc[states.anio < target_year].copy().sort_values(['entidad_clave', 'anio'])
    history['abstencion_pp'] = 100 * history.no_votaron / (history.si_votaron + history.no_votaron)
    history['cambio'] = history.groupby('entidad_clave').abstencion_pp.diff()
    relevant = history.loc[history.anio.map(election_type).eq(election_type(target_year))].dropna(subset=['cambio'])
    if relevant.empty:
        raise ValueError('No hay transiciones previas para ajustar por tipo')
    return float(relevant.cambio.mean()), sorted(int(y) for y in relevant.anio.unique())


def fit_ridge(train, alpha=10.0):
    if train.anio.nunique() < 2:
        raise ValueError('Se requieren al menos dos elecciones objetivo de entrenamiento')
    x = train[FEATURES].to_numpy(dtype=float)
    y = (train.objetivo_abstencion_pp - train.abstencion_mismo_tipo_pp).to_numpy(dtype=float)
    mean, scale = x.mean(axis=0), x.std(axis=0, ddof=0)
    scale[scale == 0] = 1.0
    design = np.column_stack([np.ones(len(x)), (x - mean) / scale])
    penalty = np.eye(design.shape[1]) * alpha
    penalty[0, 0] = 0
    beta = np.linalg.solve(design.T @ design + penalty, design.T @ y)
    return dict(features=FEATURES, alpha=alpha, mean=mean.tolist(), scale=scale.tolist(),
                beta=beta.tolist(), train_years=sorted(int(y) for y in train.anio.unique()), n_train=len(train))


def ridge_predict(fit, test):
    if max(fit['train_years']) >= test.anio.min():
        raise ValueError('El entrenamiento incluye el futuro del test')
    x = (test[fit['features']].to_numpy(dtype=float) - np.array(fit['mean'])) / np.array(fit['scale'])
    return test.abstencion_mismo_tipo_pp.to_numpy() + np.column_stack([np.ones(len(x)), x]) @ np.array(fit['beta'])


def predict_fold(features, states, year):
    train = features.loc[features.anio < year]
    test = features.loc[features.anio.eq(year)].copy()
    if len(test) != 32:
        raise ValueError('El fold no contiene las 32 entidades')
    fit = fit_ridge(train)
    shift, shift_years = historical_type_shift(states, year)
    arrays = dict(ultima_eleccion=test.abstencion_ultimo_pp.to_numpy(),
                  mismo_tipo=test.abstencion_mismo_tipo_pp.to_numpy(),
                  ultimo_ajustado_tipo=test.abstencion_ultimo_pp.to_numpy() + shift,
                  ridge_residual=ridge_predict(fit, test))
    predictions = []
    for model, values in arrays.items():
        frame = test[['anio', 'entidad_clave', 'entidad_nombre', 'tipo_eleccion',
                      'objetivo_abstencion_pp', 'max_anio_fuente']].copy()
        frame['modelo'] = model
        frame['prediccion_sin_limitar_pp'] = values
        frame['prediccion_abstencion_pp'] = np.clip(values, 0, 100)
        frame['limitada_0_100'] = frame.prediccion_sin_limitar_pp.ne(frame.prediccion_abstencion_pp)
        frame['error_pp'] = frame.prediccion_abstencion_pp - frame.objetivo_abstencion_pp
        frame['error_absoluto_pp'] = frame.error_pp.abs()
        frame['uso'] = 'desarrollo' if year == 2021 else 'prueba_final'
        predictions.append(frame)
    return pd.concat(predictions, ignore_index=True), dict(ridge=fit, ajuste_tipo_pp=shift,
                                                          anios_transiciones=shift_years)


def metrics(predictions):
    rows = []
    scopes = [(str(year), part) for year, part in predictions.groupby('anio')]
    scopes.append(('global_desarrollo_y_prueba', predictions))
    for scope, part in scopes:
        for model, data in part.groupby('modelo'):
            absolute = data.error_absoluto_pp.to_numpy()
            rows.append(dict(periodo=scope, modelo=model, n=len(data), mae_pp=float(absolute.mean()),
                             mediana_error_abs_pp=float(np.median(absolute)), p90_error_abs_pp=float(np.quantile(absolute, .9)),
                             max_error_abs_pp=float(absolute.max()), sesgo_pp=float(data.error_pp.mean()),
                             rmse_pp=float(np.sqrt(np.mean(data.error_pp.to_numpy() ** 2))),
                             pronosticos_limitados=int(data.limitada_0_100.sum())))
    return pd.DataFrame(rows)


def select_model(development_predictions):
    if set(development_predictions.anio) != {2021}:
        raise ValueError('La selección solo puede usar desarrollo 2021')
    scores = development_predictions.groupby('modelo').error_absoluto_pp.mean()
    reference = float(scores['mismo_tipo'])
    eligible = [m for m in ['ultimo_ajustado_tipo', 'ridge_residual'] if reference - scores[m] >= 0.5]
    selected = min(eligible, key=lambda m: (scores[m], m == 'ridge_residual')) if eligible else 'mismo_tipo'
    return dict(modelo=selected, elegido_con=2021, umbral_mejora_pp=0.5,
                mae_desarrollo={m: float(v) for m, v in scores.items()},
                regla='Mismo tipo salvo mejora >=0.5 pp en 2021; entre elegibles menor MAE; no reseleccionar con 2024')
