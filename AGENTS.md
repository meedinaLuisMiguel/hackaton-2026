# `agent.md` — Guía Técnica y Bitácora de Arquitectura del Proyecto

> **Proyecto:** Guía de Páramo Sin Señal — PNN Los Nevados  
> **Contexto:** Hackatón INNOVA GENERACIONES (Universidad de Caldas & ACOPI Caldas)  
> **Misión:** Aplicación web *mobile-first* para interpretación ambiental y orientación de seguridad en el Parque Nacional Natural Los Nevados (Colombia). Catálogos, radar, protocolos y bitácora tienen respaldo local; chat y visión usan Ollama local cuando está disponible y cuentan con respuestas de respaldo donde la app lo permite. No afirmar que la app tenga mapas de rutas descargables.

---

## 1. Decisiones Arquitectónicas Acordadas

1. **Formato de entrega:** Web App tradicional (`FastAPI + React + Docker Compose`), sin servidor MCP ni empaquetado single-file.
2. **Motor de IA local:** Ollama local (`gemma3:4b` por defecto, configurable vía `OLLAMA_MODEL` y `OLLAMA_VISION_MODEL`) con respuestas deterministas de respaldo para chat y funciones locales para continuidad. El indicador de estado representa conexión con el backend/modelo local, no conexión general a Internet.
3. **Alcance funcional y UI/UX:** Fusión completa entre [prompt_maestro_setup_agente_ia.md](prompt_maestro_setup_agente_ia.md) y los prototipos en `UX_UI/`:
   - Radar GPS + simulador de altitud (`2.300 m` – `4.800 m`)
   - 3 rutas incluidas en el catálogo con estaciones y reglas; no se descargan mapas de ruta
   - Bitácora offline de observaciones en ruta (`localStorage`)
   - Lente de Páramo (visión desde cámara/archivo y 4 muestras locales; puede describir objetos cotidianos y aclara que su especialidad es el PNN Los Nevados)
   - Agente Kumanday (chat con contexto, herramientas locales y respaldo; puede responder consultas generales breves e indicar que su especialidad es el parque)
   - Módulo *Protegiendo la Vida* (triaje informativo de soroche, hipotermia y riesgo volcánico + flujo SOS simulado + directorio de emergencias de Caldas)
4. **Entorno de ejecución:** Docker Compose como entorno principal + ejecución nativa en Windows (`uv` + `pnpm` + `ollama`).
5. **Cero dependencias externas en runtime:** Sin Google Fonts, sin CDNs de Tailwind ni URLs remotas de imágenes; todos los íconos (`lucide-react`) e imágenes de prueba (`frontend/public/samples/`) están empaquetados localmente.

---

## 2. Stack Tecnológico

### Backend (`backend/`)
- **Lenguaje y gestor:** Python `3.15` (`uv`)
- **Framework y librerías:** `fastapi[standard]`, `uvicorn`, `httpx`, `pillow`, `pydantic-settings`, `python-multipart`
- **Calidad y pruebas:** `ruff` (linting), `ty` (type checking), `pytest` + `pytest-asyncio` (pruebas con `httpx.ASGITransport`)

### Frontend (`frontend/`)
- **Core:** React `19.3.1`, TypeScript `~7.0.2`, Vite `8.3.8` (`pnpm`)
- **Estilos e íconos:** Tailwind CSS `4.3.5` (`@tailwindcss/vite`), `lucide-react` `1.79.0`
- **Calidad:** `oxlint`, `tsc -b`, `vite build`

### IA Local e Infraestructura (`ollama/` y raíz)
- **Ollama:** Imagen `ollama/ollama:0.40.18-rc0` con modelo por defecto `gemma3:4b`
- **Orquestación:** Docker Compose (`ollama` en red `internal`, `backend` en `internal` + `public`, `frontend` Nginx en `public`)
- **Proxy inverso:** Nginx (`frontend/nginx.conf`) redirige `/api/` hacia `http://backend:8000/api/` con `client_max_body_size 10m` y `proxy_read_timeout 120s`.

---

## 3. Estructura del Repositorio

```text
hackaton-2026/
├── agent.md                              # Este documento vivo de arquitectura y proceso
├── README.md                             # Guía rápida de instalación y ejecución
├── docker-compose.yml                    # Orquestación ollama + backend + frontend
├── prompt_maestro_setup_agente_ia.md     # Especificación maestra del proyecto
├── UX_UI/                                # Prototipos HTML y guía visual de referencia
├── ollama/
│   └── Dockerfile                        # Imagen Ollama con pre-descarga de gemma3:4b
├── backend/
│   ├── Dockerfile                        # Build multi-stage con uv y usuario no-root
│   ├── pyproject.toml                    # Dependencias, ruff y pytest config
│   ├── uv.lock
│   ├── src/backend/
│   │   ├── main.py                       # FastAPI app, CORS y endpoints /api/*
│   │   ├── config.py                     # Settings con pydantic-settings (.env)
│   │   ├── schemas.py                    # Modelos Pydantic v2
│   │   ├── knowledge.py                  # Carga JSON y calculadora de pisos térmicos
│   │   ├── rag_engine.py                 # Recuperación local, Ollama Chat/Vision y fallback
│   │   └── data/
│   │       └── pnnn_knowledge.json       # Base científica verificada del PNN Los Nevados
│   └── tests/
│       ├── test_knowledge_and_radar.py   # Pruebas unitarias de conocimiento y altitudes
│       └── test_api.py                   # Pruebas async de integración + mocks Ollama
└── frontend/
    ├── Dockerfile                        # Build Vite + runtime Nginx Alpine
    ├── nginx.conf                        # SPA fallback + reverse proxy /api/
    ├── index.html                        # HTML offline sin enlaces externos
    ├── vite.config.ts                    # Vite + Tailwind v4 + proxy /api en dev
    ├── public/samples/                   # 4 fotos locales para pruebas rápidas de visión
    │   ├── frailejon.jpg
    │   ├── chivito.jpg
    │   ├── condor.jpg
    │   └── oso.jpg
    └── src/
        ├── index.css                     # Temas, identidad visual, responsive y slider táctil
        ├── App.tsx                       # Shell mobile-first, portada y estado global
        ├── types/paramo.ts               # Contratos TypeScript
        ├── data/offlineData.ts           # Respaldo estático completo y calculadora local
        ├── services/api.ts               # Cliente fetch con timeouts y fallback offline
        └── components/
            ├── Navbar.tsx                # Barra inferior flotante estilo píldora
            ├── KumandayMark.tsx           # Emblema vectorial compartido
            ├── GpsRadar.tsx              # GNSS + simulador de altitud + riesgo soroche
            ├── TrailCatalog.tsx          # Buscador, 3 rutas PNNN y Bitácora offline
            ├── VisionLens.tsx            # Visor de cámara/archivo + muestras rápidas
            ├── RagChat.tsx               # Chat científico RAG con chips rápidos
            └── SafetyModal.tsx           # Triaje médico/volcánico, SOS y directorio Caldas
```

---

## 4. Arquitectura Técnica y Flujo de Datos

### Endpoints del Backend (`http://localhost:8000`)
- `GET /api/health` — Verifica conectividad con Ollama (`/api/tags`), modelos activos, cantidad de especies y disponibilidad local de respaldo (`offline_ready`). No mide conexión a Internet.
- `GET /api/rutas` — Devuelve las 3 rutas oficiales de `pnnn_knowledge.json`.
- `GET /api/especies` — Devuelve el catálogo de 12 especies.
- `GET /api/radar?altitud=<m>` — Calcula piso térmico, temperatura estimada, especies probables y riesgo de soroche.
- `GET /api/protocolos` — Devuelve protocolos de vida (`soroche`, `hipotermia`, `volcanico`) y directorio de emergencias de Caldas.
- `POST /api/chat` — En preguntas del parque ejecuta herramientas locales y recupera datos de `pnnn_knowledge.json` (normaliza tildes y prioriza palabras clave de seguridad), consulta a Ollama y usa respuestas deterministas para consultas cubiertas si falla. En preguntas generales puede responder con Ollama y recuerda brevemente la especialidad del agente.
- `POST /api/vision` — Valida base64 e imágenes raster JPEG/PNG/WebP (hasta 8 MiB y mínimo 32×32), corrige orientación EXIF, redimensiona a máximo `512px` JPEG con Pillow, consulta a Ollama multimodal y valida especies contra el catálogo. También puede describir objetos fuera del catálogo sin presentarlos como especies del parque. Los hints locales se limitan a muestras de demostración; no inventar identificaciones de fotos del usuario si el modelo falla.

### Estrategia *Offline-First* en el Frontend
- Cada llamada en `src/services/api.ts` usa `AbortController` con timeout corto para lectura (`2.5s`–`3.5s`) y `45s` para inferencia IA (`/api/chat`, `/api/vision`).
- Si el backend o Ollama no responden, `offlineData.ts` calcula localmente el radar de altitud, responde consultas clave del chat y ofrece fichas para las muestras locales de visión sin presentar esas fichas como análisis de una foto arbitraria.
- La bitácora de campo persiste localmente en `localStorage` (`pnnn_bitacora_v1`). El catálogo de rutas está incluido, pero no hay descarga de mapas ni un botón para guardar rutas.

---

## 5. Reglas del Proyecto para Futuros Agentes

1. **100 % gratuito y local:** Prohibido integrar APIs de pago o servicios externos en la app.
2. **Rigor científico y prioridad de vida:** Toda respuesta debe apoyarse en `pnnn_knowledge.json` y priorizar protocolos de descenso ante síntomas de soroche, hipotermia o actividad volcánica.
3. **Estética y ergonomía:** Mantener el diseño mobile-first, alto contraste en ambos temas y controles táctiles accesibles (objetivo mínimo de 44 px cuando aplique). La barra inferior fija, el compositor móvil y áreas seguras no deben cubrir contenido.
4. **Cero regresiones:** Ejecutar las comprobaciones de calidad antes de cerrar cualquier cambio.

---

## 6. Comandos de Operación y Verificación

### Ejecución con Docker Compose (Recomendado)
```powershell
docker compose up --build
```
- App web: `http://localhost:5173`
- API FastAPI / Swagger: `http://localhost:8000/docs`

### Ejecución nativa en Windows (Desarrollo)
```powershell
# Terminal 1 (opcional para IA generativa viva)
ollama pull gemma3:4b
ollama serve

# Terminal 2 - Backend
cd backend
uv sync
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3 - Frontend
cd frontend
pnpm install
pnpm dev
```

### Verificación de Calidad
```powershell
# Backend (lint + tipos + pruebas unitarias/integración)
cd backend
uv run ruff check src tests
uv run ty check
uv run pytest -v

# Frontend (lint + TypeScript + build de producción)
cd frontend
pnpm lint
pnpm build
```

---

## 7. Registro de Progreso

### Fase 1 — Implementación inicial y validación local (Completada)
- [x] Análisis del proyecto completo (`prompt_maestro_setup_agente_ia.md`, `UX_UI/`, `docker-compose.yml`, `backend/`, `frontend/`, `ollama/`).
- [x] Definición de `pnnn_knowledge.json` y endpoints FastAPI en `backend/src/backend/`.
- [x] Implementación de suite de pruebas en `backend/tests/`.
- [x] Construcción de la UI *mobile-first* en `frontend/src/` con 4 imágenes locales en `frontend/public/samples/` y `lucide-react`.
- [x] Configuración de proxy `/api/` en `frontend/nginx.conf`, `frontend/vite.config.ts` y healthcheck/volumen en `docker-compose.yml`.

### Fase 2 — Agente Kumanday, Visión Estricta, 12 Especies y Optimización (Completada)
- [x] Identidad propia: **Kumanday** (Agente Guardaparques e Intérprete Científico del PNN Los Nevados).
- [x] Orquestación de agente en `rag_engine.py`: clasificación contextual de consultas, ejecución determinista de herramientas PNNN (`consultar_radar_altitud`, `consultar_especie`, `consultar_ruta`, `activar_protocolo_vida`), respuestas generales breves con mención natural de su especialidad, acciones sugeridas en UI (`open_safety`, `open_rutas`) y formato conciso para respuestas del parque.
- [x] Expansión del catálogo verificado a **12 especies nativas** (flora y fauna de los 4 pisos térmicos) + endpoint `GET /api/especies` y explorador offline en `VisionLens.tsx`.
- [x] Blindaje de Visión IA: validación estricta de formato (`JPG/PNG/WebP`, `<= 8 MB` en cliente y backend, `>= 32x32` px, `ImageOps.exif_transpose`), Ollama `format: "json"`, distinción entre objetos cotidianos y especies del ecosistema, bloqueo de falsos positivos y rechazo honesto de identificaciones científicas no verificadas cuando Ollama no está disponible.
- [x] Corrección de botones y estado UI: eliminación definitiva del bug de mensaje duplicado en React `<StrictMode>` levantando el estado del chat a `App.tsx` con mutex (`sendingChatRef`), preservación de pestañas al navegar, botón `"Re-analizar captura"` sobre la imagen activa y bloqueo de botones durante carga.
- [x] Optimización de rendimiento: pool de conexiones `httpx.AsyncClient` en `lifespan` de FastAPI, `GZipMiddleware`, headers `Cache-Control` en catálogos estáticos, `keep_alive: "15m"` en Ollama, redimensionado visual a `512px` y cancelación de peticiones `/api/radar` obsoletas con `AbortController`.

### Fase 3 — Identidad, UX móvil y documentación de entrega (En curso)
- [x] Identidad de Kumanday: emblema SVG compartido en portada, encabezado y favicon; bienvenida ilustrada localmente con capas de relieve, curvas topográficas y frailejón.
- [x] Secuencia de bienvenida de 7,2 segundos con CTA visible, opción **Saltar animación** y soporte de `prefers-reduced-motion`.
- [x] Temas claro/oscuro, contraste semántico, botones de seguridad/tema agrupados y controles accesibles para subir al inicio.
- [x] Chat móvil: compositor anclado sobre teclado mediante `VisualViewport`; mensajes como única zona desplazable mientras el teclado está abierto; evitar saltos al entrar desde pestañas ocultas.
- [x] Rutas & GPS: retirado el falso control de guardar/descargar mapas; estaciones y reglas se expanden manteniendo visible la tarjeta; el gesto global no debe interferir con el slider.
- [x] Pie de créditos al final en pestañas cortas sin superponerse al contenido largo; la pestaña de chat reserva espacio para el compositor fijo.
- [ ] Revisar en dispositivo móvil físico el teclado virtual, permisos de cámara/ubicación y gestos; la vista previa de escritorio no sustituye esa verificación.
- [x] Consolidar documentación técnica en este `agent.md`, completar `backend/README.md` y conservar el README de raíz para ejecución/demo/producto.
