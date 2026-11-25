# 🏔️ Kumanday — Guía de Páramo Sin Señal (PNN Los Nevados)

MVP desarrollado para la hackatón **INNOVA GENERACIONES** (Universidad de Caldas & ACOPI Caldas). **Kumanday** es una aplicación web *mobile-first* y **100 % offline-first** con un agente de IA local para interpretación ambiental y seguridad en alta montaña en el **Parque Nacional Natural Los Nevados (Colombia)** sin depender de internet ni APIs de pago.

## ✨ Funcionalidades principales

- **Radar GPS por Altitud y Pisos Térmicos:** Lectura GNSS del dispositivo + simulador de altitud (`2.300 m` a `4.800 m`) con cálculo automático de piso térmico, especies probables y riesgo de soroche.
- **Catálogo Oficial PNNN y Bitácora Offline:** 3 corredores verificados (*Brisas – Valle de las Tumbas*, *Cisne – Laguna Verde* y *Potosí – Laguna del Otún*) con estaciones, reglas obligatorias, descarga offline y bitácora de campo persistida en el dispositivo.
- **Lente de Páramo (Visión IA Estricta):** Validación estricta de imágenes (`JPG`, `PNG`, `WebP`), identificación multimodal con Ollama (`gemma3:4b`) que descarta especies fuera del ecosistema PNNN, 4 muestras rápidas locales y explorador offline de **12 especies verificadas**.
- **Agente Kumanday (IA Local con Herramientas):** Orquestador contextualizado en `pnnn_knowledge.json` que ejecuta herramientas locales (`consultar_radar_altitud`, `consultar_especie`, `consultar_ruta`, `activar_protocolo_vida`), bloquea temas fuera de dominio y entrega respuestas concisas sin divagar.
- **Protegiendo la Vida (Triaje y SOS):** Triaje interactivo de *Soroche*, *Hipotermia* y *Seguridad Volcánica*, baliza SOS satelital simulada y directorio de emergencias de Caldas offline.

## 🚀 Cómo ejecutar

### Opción A: Docker Compose (Recomendado)

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173` (Nginx con proxy `/api/` hacia el backend)
- Backend API: `http://localhost:8000` (Swagger en `/docs`)
- Modelo Ollama preconfigurado: `gemma3:4b`

### Opción B: Desarrollo nativo en Windows (`uv` + `pnpm` + Ollama local)

1. **Ollama local (opcional, tiene fallback offline si no está encendido):**
   ```powershell
   ollama pull gemma3:4b
   ollama serve
   ```
2. **Backend (puerto 8000):**
   ```powershell
   cd backend
   uv sync
   uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
3. **Frontend (puerto 5173):**
   ```powershell
   cd frontend
   pnpm install
   pnpm dev
   ```

## ✅ Verificación y Calidad

### Backend (`ruff`, `ty`, `pytest`)
```powershell
cd backend
uv run ruff check src tests
uv run ty check
uv run pytest -v
```

### Frontend (`oxlint`, `tsc`, `vite build`)
```powershell
cd frontend
pnpm lint
pnpm build
```
