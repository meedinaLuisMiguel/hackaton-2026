# INSTRUCCIONES DE DESARROLLO PARA AGENTE DE IA
**Proyecto:** "Guía de Páramo Offline" (MVP para Hackatón)
**Objetivo:** Desarrollar una aplicación web local (Offline-first) para asistencia en ecoturismo de alta montaña, con capacidades de RAG (Generación Aumentada por Recuperación), visión artificial y geolocalización. El sistema debe correr localmente y será expuesto vía Ngrok.

## 1. STACK TECNOLÓGICO (100% Gratuito y Open Source)
- **Frontend:** React (Vite) + Tailwind CSS + shadcn/ui (para componentes profesionales y rápidos).
- **Backend:** Python + FastAPI.
- **Motor de IA Local:** Ollama.
  - *Modelo de Lenguaje (Chat/RAG):* `llama3.2:1b` o `gemma2:2b` (ligeros y rápidos).
  - *Modelo de Visión:* `llava-phi3` o `moondream` (para análisis de imágenes de especies).
- **Base de Datos / RAG:** FAISS (Vector Store local) + SQLite (para catálogo de rutas).
- **Librerías Clave:** LangChain (Python), HTML5 Geolocation API (Frontend).

## 2. ARQUITECTURA DE CARPETAS SOLICITADA
Por favor, inicializa el proyecto con la siguiente estructura:
```text
/paramo-guide-mvp
│
├── /backend                 # Servidor FastAPI
│   ├── main.py              # Endpoints de la API
│   ├── /data                # Documentos PDF/TXT sobre flora, fauna y rutas
│   ├── /vector_store        # Base de datos FAISS generada
│   ├── rag_engine.py        # Lógica de LangChain y Ollama
│   └── requirements.txt     # Dependencias de Python
│
└── /frontend                # App React (Vite)
    ├── /src
    │   ├── /components      # Componentes UI (Chat, Mapa, Cámara)
    │   ├── /pages           # Vistas (Catálogo, Asistente, Exploración Libre)
    │   └── App.jsx          # Enrutamiento principal
    ├── package.json
    └── tailwind.config.js
```

## 3. PASOS DE INSTALACIÓN Y CONFIGURACIÓN (Ejecutar en orden)

### Paso 3.1: Configuración del Backend (Python)
1. Crea un entorno virtual: `python -m venv venv`
2. Instala dependencias en `requirements.txt`:
   `fastapi uvicorn langchain langchain-community faiss-cpu sentence-transformers python-multipart pydantic`
3. Genera un script `rag_engine.py` que:
   - Lea archivos `.txt` de la carpeta `/data` (inventa datos dummy de 2 rutas de páramo y 5 especies de flora/fauna).
   - Cree embeddings usando `sentence-transformers/all-MiniLM-L6-v2` (corre en CPU).
   - Guarde el índice en FAISS.
   - Configure un prompt estricto: *"Eres un guía de alta montaña. Solo puedes responder basándote en el contexto proporcionado. Si te preguntan algo fuera del contexto del páramo, indica amablemente que tu conocimiento se limita a este ecosistema."*

### Paso 3.2: Configuración del Frontend (React)
1. Inicializa Vite: `npm create vite@latest frontend -- --template react`
2. Instala Tailwind CSS y configúralo.
3. Instala dependencias: `npm install axios lucide-react react-router-dom`
4. Implementa un diseño "Mobile-First" (ya que se usará en celulares en la montaña). Usa colores inspirados en el páramo (verdes oscuros, grises, tonos tierra).

## 4. FUNCIONALIDADES CORE A DESARROLLAR (MVP)

**Feature 1: Catálogo de Senderismo (Offline)**
- Crea una vista principal con tarjetas de rutas (ej. "Ruta de los Frailejones", "Ascenso Laguna Verde").
- Al seleccionar una, carga la información estática (distancia, dificultad, clima) desde el backend.

**Feature 2: Exploración por Geolocalización**
- Usa `navigator.geolocation.getCurrentPosition` en el frontend.
- Envía las coordenadas (simuladas para el MVP) al backend.
- El backend debe retornar qué especies (flora/fauna) son comunes en esa altitud/coordenada.

**Feature 3: Visión Artificial (Identificación de especies)**
- Crea un componente para subir/tomar una foto.
- Envía la imagen en base64 al endpoint `/api/vision` de FastAPI.
- El backend envía la imagen a la API local de Ollama (modelo de visión) con el prompt: *"Identifica si esta imagen contiene flora o fauna de páramo de forma breve"*.

**Feature 4: Chat Bot Experto (RAG)**
- Una interfaz de chat simple.
- Las preguntas van al endpoint `/api/chat`.
- FastAPI usa FAISS para buscar el contexto relevante y se lo pasa a Ollama para generar la respuesta.

## 5. INSTRUCCIONES DE EJECUCIÓN (Para el humano)
*Nota para el agente: Imprime estas instrucciones al finalizar la configuración.*
1. Iniciar Ollama y descargar modelos: `ollama run llama3.2:1b` y `ollama pull llava-phi3`
2. Iniciar backend: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
3. Iniciar frontend: `cd frontend && npm run dev -- --host`
4. Exponer con Ngrok: `ngrok http 5173` (y compartir el enlace).