# Frontend Kumanday

Interfaz React, TypeScript y Vite para la guía local del PNN Los Nevados.

## Desarrollo

Desde esta carpeta:

```powershell
pnpm install
pnpm dev
```

El servidor Vite (puerto 5173) redirige `/api` a `http://localhost:8000`. Para que chat y visión usen el modelo local, el backend debe estar activo y configurado para alcanzar Ollama. Comprueba el estado en la pestaña **Kumanday IA**.

## Calidad

```powershell
pnpm lint
pnpm build
```

## Convenciones del repositorio

La arquitectura, las convenciones compartidas y la bitácora del proyecto están centralizadas en [`../agent.md`](../agent.md). La descripción del producto, sus límites y los pasos de demo están en el README de la raíz.
