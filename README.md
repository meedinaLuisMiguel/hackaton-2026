# Kumanday — Guía local del PNN Los Nevados

MVP mobile-first para explorar rutas, especies y orientación de seguridad de alta montaña. El catálogo y los respaldos deterministas están incluidos localmente. Las funciones de chat y visión usan Ollama cuando el backend puede alcanzar el modelo configurado.

## Funciones

- Radar de altitud con lectura de geolocalización del dispositivo y ajuste simulado.
- Tres rutas y catálogo de especies incluidos en la app; estaciones y reglas se consultan al expandir cada ruta. La bitácora se guarda localmente.
- Identificación visual con Ollama y fichas locales para muestras de demostración.
- Chat Kumanday con contexto de altitud, especies y rutas, más respuestas deterministas si Ollama no está disponible.
- Triaje informativo y directorio de emergencias.

Las rutas muestran estaciones y reglas obligatorias; no hay descarga de mapas. La bitácora se guarda localmente en este navegador. El acceso offline requiere haber cargado la aplicación. El contenido de seguridad es informativo y no sustituye protocolos oficiales ni instrucciones del personal del parque.

## Interfaz y navegación móvil

- El tema claro/oscuro ajusta las superficies, el texto y los avisos de seguridad para mantener contraste legible.
- El compositor del chat permanece fijo sobre la navegación inferior en pantallas pequeñas y se desplaza cuando aparece el teclado.
- El pie de créditos se mantiene al borde inferior en pestañas con poco contenido, justo encima de la navegación; acompaña al contenido si la pestaña es larga. El chat reserva espacio adicional para su compositor fijo.
- En **Rutas & GPS**, abre **Ver estaciones y reglas** para consultar los detalles del recorrido; la tarjeta queda visible al expandirla.
- El botón flotante de flecha sube al inicio cuando la página ya se desplazó. En móvil también se puede deslizar hacia arriba sobre el contenido para volver arriba. Los gestos en controles, botones y campos de entrada se reservan para esos controles.
- El deslizador de altitud modifica una referencia simulada. No representa una lectura GPS real; la ubicación real se solicita con **Sincronizar GPS del dispositivo**.
- La bienvenida inmersiva dura 7,2 segundos: revela el amanecer, las capas del páramo, curvas topográficas y un frailejón. El botón **Saltar animación** permite entrar de inmediato; con movimiento reducido, la portada aparece directamente en su estado final.

## Demo nativa en Windows con Ollama en este PC

Requisitos: Ollama, `gemma3:4b`, `uv` y `pnpm` instalados.

1. Terminal de Ollama:

   ```powershell
   ollama pull gemma3:4b
   ollama serve
   ```

2. En otra terminal, iniciar backend:

   ```powershell
   cd backend
   uv sync
   uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

   El backend nativo apunta por defecto a `http://localhost:11434`.

3. En otra terminal, iniciar frontend:

   ```powershell
   cd frontend
   pnpm install
   pnpm dev
   ```

4. Abrir `http://localhost:5173`. En el encabezado y en **Kumanday IA**, confirma que aparece “IA local lista” y que se muestra el modelo configurado. Si indica que el modelo falta o no está disponible, chat/visión usan el respaldo cuando esté habilitado.

## Docker Compose

```powershell
docker compose up --build
```

Este modo ejecuta Ollama dentro de Docker y guarda el modelo en un volumen. Para usar Ollama instalado en el host, configura `OLLAMA_BASE_URL=http://host.docker.internal:11434` en el servicio backend y asegúrate de que el host permite conexiones desde Docker.

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000` (documentación en `/docs`)

## Verificación

```powershell
cd frontend
pnpm lint
pnpm build
```

```powershell
cd backend
uv run ruff check src tests
uv run ty check
uv run pytest -v
```
