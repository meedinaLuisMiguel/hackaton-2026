# Kumanday · Interpretación del recorrido norte

Prototipo mobile-first para descubrir cinco estaciones del PNN Los Nevados y consultar a Kumanday, que prioriza la evidencia de los guiones entregados por UTON. Cada respuesta respaldada muestra documento y página. Si una pregunta segura de naturaleza no está cubierta, la IA local puede ofrecer una explicación general con un aviso explícito de que no está validada por UTON; eso no confirma presencia de especies en el parque. Las preguntas médicas, volcánicas, de acceso o actualidad se derivan a un guía experto autorizado.

## Experiencia

- **Estaciones:** Brisas, Aguacerales, Arenales, Lunares/Valle Lunar y Valle de las Tumbas, con experiencias breves y citas de fuente.
- **Kumanday IA:** prioriza texto paginado de los guiones UTON y muestra documento/página cuando lo cita. Para preguntas seguras de naturaleza sin respaldo UTON, puede usar Ollama local con un aviso fijo de que la explicación es general y no está validada por UTON; no deduce presencia o abundancia de especies en el parque. El catálogo local responde preguntas generales de biodiversidad sin presentarse como inventario completo. Las preguntas de actualidad, acceso o seguridad se abstienen y remiten a un guía autorizado. Sin modelo, se limita al catálogo determinista y extractos UTON citados.
- **Fuente UTON:** se puede cargar PDF, TXT, CSV o DOCX (máximo 8 MiB). La carga reemplaza la fuente inicial en la sesión actual y se elimina al cerrar/recargar. No constituye aprobación oficial ni se guarda para otros usuarios.
- **Idioma:** selector español/inglés. Como los guiones entregados están en español, las respuestas sustentadas se mantienen en español para evitar cambios de sentido no validados.
- **Protegiendo la Vida · SOS:** información sobre señales, directorio local y pasos para pedir ayuda al personal. La app no diagnostica ni transmite una alerta satelital.
- **Herramientas secundarias:** bitácora local y lente de visión. Desde SOS, la persona puede solicitar y copiar sus coordenadas GPS junto con la precisión estimada por el dispositivo; la app no envía alertas satelitales.

La demo offline debe cargarse antes de desconectar el dispositivo. La IA depende del modelo Ollama local, no de internet. No hay mapas de rutas descargables.

## Ejecutar en Windows

Requisitos: Python 3.15, `uv`, Node.js y `pnpm`. Para generación local instala Ollama y el modelo configurado.

1. Instala las dependencias del backend:

   ```powershell
   cd backend
   uv sync
   ```

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
