# Kumanday · Interpretación del recorrido norte

Prototipo mobile-first para descubrir cinco estaciones del PNN Los Nevados y consultar a Kumanday, que prioriza la evidencia de los guiones entregados por UTON. Cada respuesta respaldada muestra documento y página. Si una pregunta segura de naturaleza no está cubierta, la IA local puede ofrecer una explicación general con un aviso explícito de que no está validada por UTON; eso no confirma presencia de especies en el parque. Las preguntas médicas, volcánicas, de acceso o actualidad se derivan a un guía experto autorizado.

## Experiencia

- **Estaciones:** Brisas, Aguacerales, Arenales, Lunares/Valle Lunar y Valle de las Tumbas, con experiencias breves y citas de fuente.
- **Kumanday IA:** prioriza texto paginado de los guiones UTON y muestra documento/página cuando lo cita. Para preguntas seguras de naturaleza sin respaldo UTON, puede usar Ollama local con un aviso fijo de que la explicación es general y no está validada por UTON; no deduce presencia o abundancia de especies en el parque. El catálogo local responde preguntas generales de biodiversidad sin presentarse como inventario completo. Las preguntas de actualidad, acceso o seguridad se abstienen y remiten a un guía autorizado. Sin modelo, se limita al catálogo determinista y extractos UTON citados.
- **Chat por voz:** graba una pregunta de hasta 30 segundos, la convierte a WAV en el navegador y la transcribe con Whisper.cpp en el servidor local. El audio se procesa en memoria, no se guarda ni se envía a terceros; la transcripción entra al mismo chat UTON. Las respuestas y citas siguen visibles y se leen solo con una voz instalada localmente. Se necesita permiso de micrófono y un contexto seguro; para un teléfono en la red local, usa HTTPS con el perfil `https` explicado abajo.
- **Fuente UTON:** se puede cargar PDF, TXT, CSV o DOCX (máximo 8 MiB). La carga reemplaza la fuente inicial en la sesión actual y se elimina al cerrar/recargar. No constituye aprobación oficial ni se guarda para otros usuarios.
- **Idioma:** selector español/inglés. Como los guiones entregados están en español, las respuestas sustentadas se mantienen en español para evitar cambios de sentido no validados.
- **Protegiendo la Vida · SOS:** información sobre señales, directorio local y pasos para pedir ayuda al personal. La app no diagnostica ni transmite una alerta satelital.
- **Herramientas secundarias:** bitácora local y lente de visión. Desde SOS, la persona puede solicitar y copiar las coordenadas que proporciona el servicio de ubicación del dispositivo, junto con su precisión estimada. Un teléfono con receptor GPS/GNSS puede obtenerlas sin Wi-Fi ni Internet (preferiblemente al aire libre; la primera fijación puede tardar hasta 2 minutos). Un PC normalmente depende de Wi-Fi o de un receptor GPS externo. Compartir coordenadas requiere un medio de comunicación. La app no envía alertas satelitales.

La demo offline debe cargarse antes de desconectar el dispositivo. La IA depende del modelo Ollama local, no de internet. No hay mapas de rutas descargables.

## Ejecutar en Windows

Requisitos: Python 3.15, `uv`, Node.js y `pnpm`. Para generación local instala Ollama y el modelo configurado.

1. Instala las dependencias del backend:

   ```powershell
   cd backend
   uv sync
   uv run python -c "from pywhispercpp.utils import download_model; download_model('base', 'models')"
   ```

   El modelo de voz se descarga una vez de forma explícita; Whisper.cpp no lo descarga al iniciar la API.

2. (Opcional) Descarga e inicia Ollama:

   ```powershell
   ollama pull gemma3:4b
   ollama serve
   ```

3. En otra terminal inicia FastAPI:

   ```powershell
   cd backend
   uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. Instala e inicia la app:

   ```powershell
   cd frontend
   pnpm install
   pnpm dev
   ```

Abre `http://localhost:5173`. API y Swagger: `http://localhost:8000/docs`.

### Micrófono desde un teléfono (HTTPS local)

Los navegadores móviles bloquean el micrófono en HTTP por IP local. Para habilitar HTTPS de desarrollo con certificado confiable:

1. Instala [mkcert](https://github.com/FiloSottile/mkcert) y crea/instala su autoridad local:

   ```powershell
   winget install FiloSottile.mkcert
   mkcert -install
   New-Item -ItemType Directory -Force frontend\certs
   ```

2. Reemplaza `192.168.1.23` por la IP Wi-Fi del equipo que ejecuta la app:

   ```powershell
   mkcert -cert-file frontend\certs\dev.pem -key-file frontend\certs\dev-key.pem localhost 127.0.0.1 192.168.1.23
   docker compose --profile https up --build
   ```

3. En el teléfono, instala y confía la CA pública `rootCA.pem` ubicada en `mkcert -CAROOT`; **no copies `rootCA-key.pem`**. Abre `https://192.168.1.23:5174`.

Los certificados quedan ignorados por Git. En Docker, la imagen del backend incluye el modelo `base`; en ejecución nativa, descárgalo con el comando del paso 1. La lectura en voz alta usa una voz del dispositivo y no envía audio remoto.

## Verificación

```powershell
cd backend
uv run ruff check src tests
uv run ty check
uv run pytest -v

cd frontend
pnpm lint
pnpm build
```

## Fuentes, límites y pendientes

Los archivos iniciales `backend/src/backend/data/uton_guides.json` corresponden a **Guion Ecoturístico UTON 2024** y **Guion turístico zona norte**, extraídos con su paginación. Sus contradicciones no se resuelven silenciosamente. Los datos de actividad volcánica, acceso, clima y salud son temporales y se remiten al guía.

La carga actual es una herramienta de demostración temporal. Antes de usarla por visitantes, UTON debe confirmar las fuentes/versiones autorizadas, revisar las fichas nuevas y definir un flujo autenticado con versionado. La presentación del reto califica operación local, citas, abstención, claridad, actualización, desempeño y documentación; el hardware y el protocolo formal de aprobación siguen pendientes de confirmación.
