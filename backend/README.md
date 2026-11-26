# Backend de Kumanday

API FastAPI para el catálogo del PNN Los Nevados, el radar de altitud, los protocolos de seguridad y las consultas de chat/visión/voz. El conocimiento verificado se carga desde `src/backend/data/pnnn_knowledge.json`. Las inferencias generativas se envían al servidor Ollama configurado; la transcripción usa Whisper.cpp local y no requiere Ollama.

La API no mide la conexión general a Internet: `/api/health` informa si puede comunicarse con Ollama y si el modelo configurado está instalado. `offline_ready` indica que las funciones locales de respaldo están disponibles.

## Requisitos y ejecución local

- Python `>=3.15`, según `pyproject.toml`.
- `uv` para dependencias, servidor y tareas de calidad.
- El modelo de voz Whisper.cpp `base` para transcripción local.
- Ollama es opcional para los respaldos, pero necesario para respuestas generativas de chat y análisis real de imágenes.

Desde esta carpeta, en una terminal:

```powershell
uv sync
uv run python -c "from pywhispercpp.utils import download_model; download_model('base', 'models')"
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

La descarga del modelo es un paso explícito de instalación y se realiza una sola vez. La API espera `models/ggml-base.bin` y no descarga modelos automáticamente en ejecución.

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
| `SPEECH_MODEL_PATH` | `models/ggml-base.bin` | Ruta local al modelo Whisper.cpp `base`. |
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
| `POST /api/chat` | Prioriza fragmentos UTON con página; si no hay respaldo, permite respuestas del catálogo local o explicaciones generales de naturaleza con aviso explícito de que no están validadas por UTON. No infiere presencia local de especies. Se abstiene ante actualidad, acceso y seguridad. |
| `POST /api/voice/transcribe` | Recibe WAV PCM mono de 16 kHz (máximo 1 MB / 30 s) y devuelve la transcripción con el modelo local; el audio solo vive en memoria. Luego el frontend envía ese texto a `/api/chat`. |
| `POST /api/vision` | Descripción de imagen e identificación prudente contra el catálogo local; puede reconocer objetos cotidianos y los distingue de especies del parque. |

Los contratos de entrada y salida se definen en `src/backend/schemas.py`. Los cuerpos de ejemplo se pueden consultar en Swagger (`/docs`). Para visión, el backend acepta JPEG, PNG y WebP, limita el archivo original a 8 MiB y exige dimensiones mínimas de 32×32 píxeles; aplica orientación EXIF y normaliza la imagen para Ollama. Los hints solo activan la ficha determinista si los bytes coinciden con una muestra local empaquetada; no pueden convertir una foto arbitraria en una identificación confirmada.

## Respaldo y límites

- Radar, rutas, especies, protocolos y directorio de emergencias no dependen de Ollama.
- El chat usa primero fragmentos UTON con documento y página. Para temas de naturaleza sin evidencia UTON puede generar respuestas generales, marcadas como no validadas, sin afirmar presencia de especies o condiciones locales.
- El catálogo local responde consultas generales de biodiversidad sin Ollama. Las respuestas generativas requieren el modelo; sin él, las preguntas no cubiertas por el catálogo o las fuentes UTON se abstienen.
- La visión no inventa identificaciones científicas cuando no puede validar una especie. Puede describir objetos fuera del catálogo e indicar el enfoque de Kumanday.
- La transcripción requiere un navegador con `getUserMedia`/`MediaRecorder`, permiso de micrófono y HTTPS (o localhost). El audio se valida, procesa en memoria y no se conserva.
- La información médica y volcánica es orientativa y no sustituye los protocolos oficiales ni al personal del parque.

## Docker Compose

La raíz del repositorio orquesta Ollama, backend y frontend:

```powershell
docker compose up --build
```

Compose inyecta la URL de Ollama del contenedor y espera el healthcheck del backend antes de iniciar el frontend. La imagen del backend usa etapas de build/runtime y ejecuta Uvicorn como usuario sin privilegios. Para cambiar el modelo, ajusta `OLLAMA_MODEL` y `OLLAMA_VISION_MODEL` en `docker-compose.yml`.

La imagen del backend descarga el modelo de voz `base` durante el build. Para usar micrófono desde un teléfono por la red Wi-Fi, crea un certificado de desarrollo confiable con mkcert y ejecuta `docker compose --profile https up --build`; los pasos completos están en el README de la raíz.

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
