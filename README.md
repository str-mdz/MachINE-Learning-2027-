# MachINE Learning 2027

**Plataforma interactiva de análisis histórico, estimación experimental y simulación de escenarios de abstención electoral en México.**

**Equipo:** The Malwares  
**Integrantes:** Mendoza Camacho, Estrella de María; Rodríguez Barrón, Emilio Humberto  
**Evento:** Hackathon Nacional del INE 2026 — *Hackea la participación*  
**Eje 2:** Predicción y escenarios de riesgo de abstención  

## Descripción del proyecto

MachINE Learning 2027 transforma datos públicos agregados de los **Conteos Censales de Participación Ciudadana (CCPC) 2009–2024** del Instituto Nacional Electoral (INE) en una plataforma de exploración histórica y análisis territorial. Incluye un modelo experimental para estimar la abstención estatal en 2027, un semáforo de riesgo relativo y escenarios hipotéticos que permiten comparar diferentes porcentajes de abstención.

La herramienta busca facilitar la interpretación de información electoral agregada. **No predice decisiones individuales ni demuestra los efectos de una intervención.**

## Funcionalidades

- Consulta histórica de participación y abstención en las elecciones federales de 2009, 2012, 2015, 2018, 2021 y 2024.
- Exploración de las 32 entidades federativas mediante un mapa interactivo con visualización tridimensional.
- Análisis descriptivo de participación observada por edad y sexo.
- Estimaciones experimentales de abstención estatal para 2027.
- Semáforo territorial de riesgo relativo: bajo, medio y alto.
- Comparación entre el escenario base y reducciones hipotéticas de 1, 3 y 5 puntos porcentuales.
- Laboratorio de Machine Learning con validación temporal, errores por entidad, comparación de configuraciones, contribuciones y sensibilidad.
- Exportación de resultados agregados en formato CSV.

## Tecnologías

| Componente | Tecnologías principales |
| --- | --- |
| Interfaz | React, TypeScript, TanStack Start, Vite |
| Visualización territorial | Three.js, React Three Fiber |
| Gráficas y estilos | Recharts, Tailwind CSS |
| Análisis científico | Python, pandas, NumPy |
| Instalación del frontend | Bun |

## Requisitos

- **Bun 1.4.4**, versión utilizada durante el desarrollo.
- **Node.js 22.12 o superior**, dentro de las versiones compatibles con las dependencias del proyecto.
- **Python 3.14.0**, versión utilizada para generar los artefactos científicos publicados, **solo si se desea verificarlos o regenerarlos**.
- Conexión a internet para descargar las dependencias.

Las dependencias de Python están fijadas en `requirements.txt`. Las del frontend se declaran en `frontend/package.json` y sus versiones se resuelven mediante `frontend/bun.lock`.

> Para **consultar la aplicación web** no es necesario instalar Python. El análisis científico ya está publicado como datos utilizados por el frontend.

## Instalación y ejecución del frontend

Desde la raíz del proyecto:

```bash
cd frontend
bun install --frozen-lockfile
bun run dev --host 127.0.0.1 --port 5173
```

Abrir en el navegador:

```text
http://127.0.0.1:5173/
```

Para generar una compilación de producción, desde `frontend/`:

```bash
bun run build
```

Se pueden consultar los demás scripts disponibles con:

```bash
bun run
```

Si `package.json` define los scripts `typecheck` o `preview`, también pueden ejecutarse con `bun run typecheck` y `bun run preview`, respectivamente.

La carpeta `frontend/node_modules/` se genera al instalar las dependencias y **no se incluye en el paquete de código fuente**. Tampoco es necesario entregar cachés ni archivos temporales de compilación.

## Instalación para reproducir el análisis científico

Desde la **raíz del proyecto**, instalar las bibliotecas Python:

```bash
python -m pip install -r requirements.txt
```

### Verificar resultados publicados

```bash
python -m scripts.estimar_ml --verificar
python -m scripts.evaluar_variantes --verificar
python -m scripts.analizar_sensibilidad --verificar
```

Estos comandos recalculan y contrastan los artefactos científicos con los resultados ya publicados. **No requieren descargar los ocho ZIP originales del INE**, pero sí conservar los archivos procesados y JSON especificados más abajo.

### Regenerar resultados

Solo cuando se desee actualizar deliberadamente los artefactos:

```bash
python -m scripts.estimar_ml --publicar
python -m scripts.evaluar_variantes --publicar
python -m scripts.analizar_sensibilidad --publicar
```

Los comandos `--publicar` **sobrescriben archivos** y deben ejecutarse en el orden mostrado. Antes de hacerlo, se recomienda conservar una copia o utilizar el control de versiones.

La comparación exacta de resultados puede depender de las versiones de Python, NumPy, pandas y del entorno numérico. Cualquier diferencia debe investigarse antes de sustituir los resultados publicados.

## Datos necesarios

La aplicación y los scripts científicos utilizan, entre otros, estos archivos y directorios, que deben mantenerse en sus rutas originales:

```text
Data/processed/participacion_estatal.csv
frontend/public/data/resumen_demografico.json
frontend/src/data/
results/tables/fase3/comparacion_modelos.csv
results/tables/fase4/
```

El archivo `resumen_demografico.json` contiene datos agregados necesarios para el análisis y la reproducción del modelo. **No debe eliminarse por su tamaño.**

Los ocho ZIP originales de los CCPC se conservan como **respaldo local fuera de esta distribución**. La entrega contiene los datos procesados necesarios para reproducir la etapa predictiva, **no el proceso histórico completo de extracción desde los archivos originales**.

Se utilizan datos agregados; el proyecto no requiere datos personales de la ciudadanía.

## Metodología

### Indicadores

La abstención y participación se calculan únicamente sobre registros con situación de votación conocida:

```text
Abstención (%)    = 100 × NV / (SV + NV)
Participación (%) = 100 × SV / (SV + NV)
```

Donde:

- **SV:** sí votaron.
- **NV:** no votaron.
- **NS:** no especificados.

Los registros `NS` se conservan por separado y **no se consideran abstención confirmada**.

### Modelo predictivo

Se utiliza una **regresión Ridge residual** que parte de la abstención observada en la última elección del mismo tipo y estima un ajuste mediante siete características históricas:

1. Brecha de abstención entre elecciones anteriores.
2. Tipo de elección.
3. Proporción previa de registros no especificados.
4. Logaritmo de la lista nominal anterior.
5. Proporción histórica de personas jóvenes.
6. Proporción histórica de personas mayores.
7. Proporción histórica de mujeres.

La configuración operativa es **`alpha = 10`** e **`intensidad del residual (lambda) = 1`**. El ajuste final utiliza **128 observaciones estatales de entrenamiento**. Para estimar la elección intermedia de 2027, la referencia del mismo tipo corresponde a **2021**, mientras que las demás características anteriores pueden utilizar información disponible hasta **2024**.

En la evaluación retrospectiva, los datos de entrenamiento y el escalado de cada corte utilizan exclusivamente información anterior a la elección evaluada.

## Evaluación retrospectiva

Los errores se expresan en **puntos porcentuales (pp)**. MAE es el error absoluto medio y RMSE es la raíz del error cuadrático medio; en ambos casos, un valor menor indica menos error.

| Método | MAE 2021 | RMSE 2021 | MAE 2024 | RMSE 2024 |
| --- | ---: | ---: | ---: | ---: |
| Última elección del mismo tipo | 7.98 | 9.86 | 3.49 | 4.13 |
| Ridge residual | 6.90 | 8.03 | 3.56 | 4.56 |
| Última elección | 9.66 | 10.59 | 6.97 | 8.20 |
| Última elección con ajuste por tipo | 5.13 | 6.09 | 9.06 | 9.88 |

Ridge presentó un error menor que la referencia de la última elección del mismo tipo en 2021, **pero no la superó en 2024**.

También se analizaron **15 configuraciones** de regularización e intensidad del residual. No se obtuvo evidencia suficiente de una mejora consistente que justificara reemplazar la configuración operativa. Los resultados de 2024 ya habían sido examinados durante el desarrollo y **no constituyen una nueva validación independiente**.

## Estimación y escenarios de 2027

La estimación nacional experimental de abstención para 2027 es **47.1919 %**, frente al **48.1620 % observado en 2021**. Esto equivale a una diferencia de **−0.9701 puntos porcentuales**.

El agregado nacional se calcula como un **promedio ponderado de las estimaciones estatales**, usando los registros conocidos (`SV + NV`) de 2021 como pesos. No es un promedio simple ni una proyección de la lista nominal de 2027.

| Escenario | Abstención nacional experimental |
| --- | ---: |
| Sin intervención (base) | 47.1919 % |
| Reducción hipotética de 1 pp | 46.1919 % |
| Reducción hipotética de 3 pp | 44.1919 % |
| Reducción hipotética de 5 pp | 42.1919 % |

Los escenarios aplican reducciones aritméticas a los porcentajes estimados, con límites entre 0 % y 100 %. **No representan efectos causales comprobados** de acciones institucionales.

El semáforo de riesgo clasifica las entidades mediante terciles de la estimación estatal de 2027. Sus umbrales permanecen fijos al comparar escenarios, de modo que los colores representen una escala común.

## Análisis de sensibilidad

El análisis de sensibilidad modifica **una variable a la vez** dentro de los rangos históricos observados para cada entidad, manteniendo fijo el modelo entrenado y el tipo de elección.

Sus resultados describen la dependencia matemática de las estimaciones respecto de las entradas. **No demuestran causalidad, no son predicciones alternativas validadas y no constituyen intervalos de confianza.**

## Estructura principal del proyecto

```text
MachINE-Learning-2027/
├── Data/
│   └── processed/
│       └── participacion_estatal.csv
├── frontend/
│   ├── public/
│   │   └── data/
│   │       └── resumen_demografico.json
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── lib/
│   │   └── routes/
│   ├── bun.lock
│   └── package.json
├── results/
│   └── tables/
│       ├── fase3/
│       └── fase4/
├── scripts/
│   ├── estimar_ml.py
│   ├── evaluar_variantes.py
│   └── analizar_sensibilidad.py
├── src/
│   └── horizonte2027/
│       └── prediccion.py
├── README.md
├── requirements.txt
└── THIRD_PARTY_NOTICES.txt
```

El árbol muestra las rutas principales; no es un inventario exhaustivo. `node_modules/`, los ZIP históricos, las cachés y las salidas temporales de compilación se excluyen del código fuente distribuido.

## Alcance y limitaciones

- El desempeño histórico **no garantiza precisión para 2027**.
- Las estimaciones son **estatales** y no deben interpretarse como pronósticos municipales ni individuales.
- Las ponderaciones del resultado nacional corresponden a 2021, no a un padrón proyectado para 2027.
- Las gráficas demográficas describen datos históricos; no son pronósticos por edad o sexo.
- Los escenarios son hipotéticos y no cuantifican el impacto real de intervenciones.
- El mapa permite la exploración visual, pero **no certifica la precisión oficial de los límites geográficos**.

## Fuente de datos y avisos de terceros

**Fuente electoral:** Instituto Nacional Electoral, [Plataforma de Conteos Censales de Participación Ciudadana 2009–2024](https://ine.mx/transparencia/datos-abiertos/visualizacion-datos/conteos-censales-participacion/).

Los avisos correspondientes al código de bibliotecas de terceros incluido directamente en esta distribución se documentan en `THIRD_PARTY_NOTICES.txt`. Las bibliotecas que se instalan por separado conservan sus propias licencias; si se redistribuyen dependencias o compilaciones que incorporen su código, deben conservarse los avisos correspondientes.
