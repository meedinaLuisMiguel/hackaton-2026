# `agent.md` — Guía Técnica y Bitácora de Arquitectura del Proyecto

> **Proyecto:** Guía de Páramo Sin Señal — PNN Los Nevados  
> **Contexto:** Hackatón INNOVA GENERACIONES (Universidad de Caldas & ACOPI Caldas)  
> **Misión:** Aplicación web *mobile-first* de interpretación ambiental para el recorrido norte del Parque Nacional Natural Los Nevados. La experiencia principal se organiza por estaciones y la IA prioriza los guiones UTON, mostrando documento y página cuando respaldan una respuesta. Si no hay evidencia UTON, puede ofrecer información general de naturaleza claramente marcada como no validada por UTON, sin atribuir al parque presencia o abundancia de especies. Las preguntas médicas, volcánicas, de acceso o actualidad se derivan a un guía experto autorizado. No afirmar que la app tenga mapas de rutas descargables ni capacidad de SOS satelital.

---

## 1. Decisiones Arquitectónicas Acordadas

1. **Formato de entrega:** Web App tradicional (`FastAPI + React + Docker Compose`), sin servidor MCP ni empaquetado single-file.
2. **Motor de IA local:** Ollama local (`gemma3:4b` por defecto) para sintetizar evidencia recuperada de guiones UTON. La evidencia UTON es prioritaria y toda respuesta respaldada lleva documento y página. Si falta un fragmento pertinente, el modelo puede explicar conceptos generales de naturaleza con un aviso fijo de que no están en los guiones ni validados por UTON; no puede presentar conocimiento general como dato local del parque. Las preguntas médicas, volcánicas, de acceso o actualidad se abstienen y remiten a un guía autorizado. El catálogo local puede responder consultas generales de biodiversidad, identificándose como catálogo y no como inventario completo. Sin Ollama se permiten respuestas deterministas del catálogo y extractos UTON citados.
3. **Alcance funcional y UI/UX:** Fusión completa entre [prompt_maestro_setup_agente_ia.md](prompt_maestro_setup_agente_ia.md) y los prototipos en `UX_UI/`:
   - Catálogo experiencial por cinco paradas del recorrido norte: Brisas, Aguacerales, Arenales, Lunares/Valle Lunar y Valle de las Tumbas.
   - Citas de los dos guiones UTON con página en cada respuesta respaldada.
   - Carga local de fuentes PDF, TXT, CSV y DOCX; el contenido cargado reemplaza las fuentes iniciales durante la sesión y no se persiste como contenido aprobado.
   - Selector de español/inglés; si la fuente validada está únicamente en español, el agente conserva el idioma original para evitar traducciones no verificadas.
   - Solicitud explícita de coordenadas GPS desde SOS, mostrando precisión estimada; la app no transmite alertas. No hay radar ni simulador de altitud en la interfaz.
   - Bitácora offline de observaciones en ruta (`localStorage`) como herramienta secundaria.
   - Lente de Páramo (visión desde cámara/archivo y 4 muestras locales; puede describir objetos cotidianos y aclara que su especialidad es el PNN Los Nevados)
   - Agente Kumanday (chat con prioridad UTON y citas visibles, respuestas generales de naturaleza marcadas como no validadas, abstención y derivación a guía autorizado).
   - Módulo *Protegiendo la Vida* informativo de soroche, hipotermia y riesgo volcánico + directorio de emergencias de Caldas. No diagnostica ni simula envío satelital.
4. **Entorno de ejecución:** Docker Compose como entorno principal + ejecución nativa en Windows (`uv` + `pnpm` + `ollama`).
5. **Cero dependencias externas en runtime:** Sin Google Fonts, sin CDNs de Tailwind ni URLs remotas de imágenes; todos los íconos (`lucide-react`) e imágenes de prueba (`frontend/public/samples/`) están empaquetados localmente.

---

## 2. Stack Tecnológico

### Backend (`backend/`)
- **Lenguaje y gestor:** Python `3.15` (`uv`)
- **Framework y librerías:** `fastapi[standard]`, `uvicorn`, `httpx`, `pillow`, `pydantic-settings`, `python-multipart`
- **Calidad y pruebas:** `ruff` (linting), `ty` (type checking), `pytest` + `pytest-asyncio` (pruebas con `httpx.ASGITransport`)
- **Extracción documental:** `pymupdf` para texto y páginas PDF; TXT/CSV por biblioteca estándar; DOCX mediante XML estándar. Archivos escaneados sin capa de texto se rechazan.

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
│   │       └── uton_guides.json            # Texto paginado de los 2 guiones oficiales del reto
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
- `GET /api/estaciones` — Devuelve cinco paradas de interpretación con resumen, experiencia y citas UTON.
- `GET /api/fuentes/uton` — Devuelve fragmentos extraídos por página de los dos guiones empaquetados.
- `POST /api/fuentes/uton` — Valida y extrae PDF/TXT/CSV/DOCX (máximo 8 MiB) para uso local en la sesión del usuario.
- `GET /api/especies` — Devuelve el catálogo de 12 especies.
- `GET /api/radar?altitud=<m>` — Calcula piso térmico, temperatura estimada, especies probables y riesgo de soroche.
- `GET /api/protocolos` — Devuelve protocolos de vida (`soroche`, `hipotermia`, `volcanico`) y directorio de emergencias de Caldas.
- `POST /api/chat` — Prioriza fragmentos UTON con fuente y página; si no hay evidencia pertinente, usa el catálogo local o permite una explicación general de naturaleza marcada como no validada por UTON. No atribuye al parque afirmaciones generales de presencia o abundancia. Se abstiene en consultas médicas, volcánicas, de acceso y actualidad; sin Ollama limita las respuestas a datos locales deterministas o extractos UTON.
- `POST /api/vision` — Valida base64 e imágenes raster JPEG/PNG/WebP (hasta 8 MiB y mínimo 32×32), corrige orientación EXIF, redimensiona a máximo `512px` JPEG con Pillow, consulta a Ollama multimodal y valida especies contra el catálogo. También puede describir objetos fuera del catálogo sin presentarlos como especies del parque. Los hints locales se limitan a muestras de demostración; no inventar identificaciones de fotos del usuario si el modelo falla.

### Estrategia *Offline-First* en el Frontend
- Cada llamada en `src/services/api.ts` usa `AbortController` con timeout corto para lectura (`2.5s`–`3.5s`) y `45s` para inferencia IA (`/api/chat`, `/api/vision`).
- Si el backend no responde, el chat se abstiene; no usa el respaldo general antiguo. Catálogo y datos UTON deben estar precargados para uso sin conexión. Los archivos subidos no se guardan ni se aprueban automáticamente.
- La bitácora de campo persiste localmente en `localStorage` (`pnnn_bitacora_v1`). El catálogo de rutas está incluido, pero no hay descarga de mapas ni un botón para guardar rutas.

---

## 5. Reglas del Proyecto para Futuros Agentes

1. **100 % gratuito y local:** Prohibido integrar APIs de pago o servicios externos en la app.
2. **Rigor científico y prioridad de vida:** Las respuestas atribuidas a UTON requieren fragmentos con documento y página. La información general de naturaleza sin respaldo UTON debe etiquetarse como no validada y nunca usarse para afirmar presencia, abundancia o ubicación de especies en el PNNN. Los datos fechados nunca se presentan como actuales. Preguntas médicas, volcánicas, de acceso o condiciones actuales se derivan a un guía experto autorizado; no afirmar diagnóstico, alerta actual ni capacidad de transmisión SOS.
3. **Estética y ergonomía:** Mantener el diseño mobile-first, alto contraste en ambos temas y controles táctiles accesibles (objetivo mínimo de 44 px cuando aplique). La barra inferior fija, el compositor móvil y áreas seguras no deben cubrir contenido.
4. **Cero regresiones:** Ejecutar las comprobaciones de calidad antes de cerrar cualquier cambio.
5. **Autoridad de fuentes:** La carga de archivo es temporal y no convierte automáticamente una guía en fuente oficial. El personal autorizado debe revisar/validar versión, contenido y páginas antes de publicarla para visitantes.

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
- [x] Rutas & GPS: retirado el falso control de guardar/descargar mapas; estaciones y reglas se expanden manteniendo visible la tarjeta; el gesto global no debe interferir con los controles.
- [x] Pie de créditos al final en pestañas cortas sin superponerse al contenido largo; la pestaña de chat reserva espacio para el compositor fijo.
- [ ] Revisar en dispositivo móvil físico el teclado virtual, permisos de cámara/ubicación y gestos; la vista previa de escritorio no sustituye esa verificación.
- [x] Consolidar documentación técnica en este `agent.md`, completar `backend/README.md` y conservar el README de raíz para ejecución/demo/producto.

### Fase 4 — Adaptación al reto UTON (En curso)
- [x] Identificar requisitos de ficha técnica y presentación: operación local, recorrido norte, cita por guion/página, abstención y derivación a guía.
- [x] Crear catálogo de cinco paradas basado en fuentes: Brisas, Aguacerales, Arenales, Lunares/Valle Lunar y Valle de las Tumbas.
- [x] Extraer y empaquetar texto paginado de los dos guiones suministrados.
- [x] Añadir carga de PDF/TXT/CSV/DOCX limitada a 8 MiB y temporal por sesión.
- [x] Priorizar citas UTON; permitir explicaciones generales de naturaleza solo con aviso explícito y límites de presencia local; abstenerse ante actualidad, acceso o seguridad.
- [x] Sustituir la falsa baliza SOS por información honesta y remisión al personal autorizado.
- [x] Retirar el radar y simulador de altitud de la pantalla de estaciones; SOS solicita coordenadas GPS solo bajo acción y permiso explícitos, informa precisión estimada y permite copiar la ubicación.
- [ ] Confirmar con UTON la validez oficial de cifras, reglas, estación Brisas, nombres culturales y contenido de seguridad; los materiales entregados no resuelven todas las discrepancias.
- [ ] Persistir y administrar fuentes aprobadas mediante un flujo exclusivo para personal autorizado, con versionado/auditoría.
- [ ] Validar con el hardware asignado consumo, velocidad, idioma alternativo y operación totalmente desconectada.
