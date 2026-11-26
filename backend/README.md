# Backend de Kumanday

API FastAPI para el catálogo del PNN Los Nevados, el radar de altitud, los protocolos de seguridad y las consultas de chat/visión. El conocimiento verificado se carga desde `src/backend/data/pnnn_knowledge.json`. Las inferencias generativas se envían al servidor Ollama configurado; si Ollama no está disponible, la API conserva los endpoints y ofrece respuestas deterministas donde están implementadas.

La API no mide la conexión general a Internet: `/api/health` informa si puede comunicarse con Ollama y si el modelo configurado está instalado. `offline_ready` indica que las funciones locales de respaldo están disponibles.

## Requisitos y ejecución local

- Python `>=3.15`, según `pyproject.toml`.
- `uv` para dependencias, servidor y tareas de calidad.
- Ollama es opcional para los respaldos, pero necesario para respuestas generativas de chat y análisis real de imágenes.

Desde esta carpeta, en una terminal:

```powershell
uv sync
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Para el modelo local de demostración, en otra terminal:

```powershell
ollama pull gemma3:4b
ollama serve
```

La API queda en `http://localhost:8000`; Swagger en `http://localhost:8000/docs` y OpenAPI en `/openapi.json`.

## Configuración

La configuración usa variables de entorno o un archivo `.env` en el directorio de trabajo del proceso. Los valores por defecto están en `src/backend/config.py`:

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL del API local de Ollama; en Compose se cambia a `http://ollama:11434`. |
| `OLLAMA_MODEL` | `gemma3:4b` | Modelo utilizado por el chat. |
| `OLLAMA_VISION_MODEL` | `gemma3:4b` | Modelo multimodal para imágenes. |
| `OLLAMA_TIMEOUT_SECONDS` | `45` | Tiempo máximo de inferencia. |
| `CORS_ORIGINS` | `["*"]` | Orígenes permitidos por CORS; para restringirlos, proporciona una lista JSON, por ejemplo `["http://localhost:5173"]`. |

El backend nativo usa el Ollama de este equipo. Docker Compose configura `OLLAMA_BASE_URL=http://ollama:11434` para el contenedor Ollama de la composición.

## Endpoints

| Método y ruta | Función |
| --- | --- |
| `GET /` | Metadatos del servicio y enlace a Swagger. |
| `GET /api/health` | Estado de Ollama, modelos disponibles, total de especies y disponibilidad de respaldo local. |
| `GET /api/rutas` | Catálogo incluido de rutas, con estaciones y reglas; no descarga mapas. |
| `GET /api/especies` | Catálogo de 12 especies locales. |
| `GET /api/radar?altitud=4150` | Piso térmico, especies probables, temperatura estimada y recomendación de seguridad para una altitud de 0 a 6000 m. |
| `GET /api/protocolos` | Protocolos informativos y directorio local de emergencias. |
| `POST /api/chat` | Consulta con contexto/herramientas del parque; admite respuesta general breve que indica la especialidad de Kumanday. Usa respaldo local si Ollama no está disponible. |
| `POST /api/vision` | Descripción de imagen e identificación prudente contra el catálogo local; puede reconocer objetos cotidianos y los distingue de especies del parque. |

Los contratos de entrada y salida se definen en `src/backend/schemas.py`. Los cuerpos de ejemplo se pueden consultar en Swagger (`/docs`). Para visión, el backend acepta JPEG, PNG y WebP, limita el archivo original a 8 MiB y exige dimensiones mínimas de 32×32 píxeles; aplica orientación EXIF y normaliza la imagen para Ollama. Los hints están reservados para las muestras de demostración y no reemplazan la identificación de una foto arbitraria.

## Respaldo y límites

- Radar, rutas, especies, protocolos y directorio de emergencias no dependen de Ollama.
- El chat de dominio se fundamenta en herramientas y datos locales; ante indisponibilidad del modelo usa respuestas deterministas para consultas cubiertas.
- Las consultas generales usan el modelo local cuando está disponible. El respaldo sin modelo se limita a explicar la especialidad del agente.
- La visión no inventa identificaciones científicas cuando no puede validar una especie. Puede describir objetos fuera del catálogo e indicar el enfoque de Kumanday.
- La información médica y volcánica es orientativa y no sustituye los protocolos oficiales ni al personal del parque.

## Docker Compose

La raíz del repositorio orquesta Ollama, backend y frontend:

```powershell
docker compose up --build
```

Compose inyecta la URL de Ollama del contenedor y espera el healthcheck del backend antes de iniciar el frontend. La imagen del backend usa etapas de build/runtime y ejecuta Uvicorn como usuario sin privilegios. Para cambiar el modelo, ajusta `OLLAMA_MODEL` y `OLLAMA_VISION_MODEL` en `docker-compose.yml`.

## Calidad

```powershell
uv run ruff check src tests
uv run ty check
uv run pytest -v
```

La suite cubre lógica de conocimiento/radar y endpoints con un transporte ASGI y Ollama simulado; no requiere que el modelo real esté activo.

## Arquitectura

- `src/backend/main.py`: endpoints FastAPI, CORS, GZip y ciclo de vida del cliente HTTP compartido.
- `src/backend/config.py`: configuración Pydantic Settings.
- `src/backend/knowledge.py`: carga de la base local y cálculo del radar.
- `src/backend/rag_engine.py`: herramientas conversacionales, prompts de chat, integración Ollama y validación/análisis visual.
- `src/backend/schemas.py`: contratos Pydantic.
- `src/backend/data/pnnn_knowledge.json`: rutas, especies, protocolos y directorio.
- `tests/`: pruebas unitarias y de integración.

La guía técnica central y las decisiones compartidas del repositorio están en [`../agent.md`](../agent.md).
