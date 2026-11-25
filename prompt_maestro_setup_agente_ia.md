# 🚀 PLAN MAESTRO DE IMPLEMENTACIÓN: GUÍA DE PÁRAMO SIN SEÑAL (PNN LOS NEVADOS)

**Contexto:** Hackatón INNOVA GENERACIONES (Universidad de Caldas & ACOPI Caldas).
**Misión:** Construir un MVP funcional, atractivo y 100% *offline-first* para la interpretación ambiental y protección de la vida en el **Parque Nacional Natural Los Nevados (PNNN)**, Colombia.

---

## 🤖 DIRECTIVAS PARA EL AGENTE (ANTIGRAVITY)

1. **Autonomía y Orden:** Ejecuta este plan por fases. Verifica que cada componente funcione antes de pasar al siguiente.
2. **100% Gratuito y Local:** Prohibido usar APIs de pago (OpenAI, Anthropic, Google Cloud, Mapbox). Todo debe correr en local usando **Ollama**, **FastAPI**, **React** y datos estáticos/locales.
3. **Respeto Estético:** Sigue estrictamente la paleta de colores y estructura UI/UX definida en la Sección 3. La app debe verse como un producto comercial de ecoturismo de alta gama, con diseño *Mobile-First* y botones grandes pensados para uso con guantes en clima frío.
4. **Rigor Científico y Seguridad:** El asistente de IA debe responder únicamente con base en el conocimiento verificado del PNN Los Nevados y priorizar la seguridad humana (soroche/hipotermia) y ecosistémica.

---

## 🛠️ 1. ARQUITECTURA Y STACK TECNOLÓGICO

```text
/paramo-los-nevados-mvp
├── /backend
│   ├── main.py                 # Servidor FastAPI + Endpoints (Rutas, GPS, Visión, Chat, Triaje)
│   ├── rag_engine.py           # Motor de búsqueda local + conexión a Ollama
│   ├── /data
│   │   └── pnnn_knowledge.json # Base de conocimiento verificada del PNN Los Nevados
│   └── requirements.txt
└── /frontend
    ├── index.html
    ├── tailwind.config.js      # Configuración de paleta PNN Los Nevados
    ├── /src
    │   ├── /components
    │   │   ├── Navbar.jsx      # Navegación inferior estilo píldora
    │   │   ├── GpsRadar.jsx    # Simulador/Lector de altitud y pisos térmicos
    │   │   ├── VisionLens.jsx  # Escáner de especies con Ollama Vision
    │   │   ├── RagChat.jsx     # Chat científico rápido
    │   │   └── SafetyModal.jsx # Módulo "Protegiendo la Vida" (Triaje Soroche/Hipotermia)
    │   ├── /data
    │   │   └── offlineData.js  # Fallback estático garantizado sin internet
    │   └── App.jsx
    └── package.json
```

* **Backend:** Python 3.10+, FastAPI, Uvicorn, Requests/HTTPX (para hablar con Ollama en `http://localhost:11434`).
* **Modelos Ollama requeridos:**
  * Texto/RAG: `llama3.2:1b` (o `gemma2:2b` si ya está descargado; verificar con `ollama list`).
  * Visión: `moondream` o `llava-phi3` (verificar disponibilidad local o descargar el más ligero).
* **Frontend:** React (Vite) + Tailwind CSS + `lucide-react`.

---

## 🏔️ 2. BASE DE CONOCIMIENTO VERIFICADA (`backend/data/pnnn_knowledge.json`)

Crea este archivo exactamente con esta información científica real del PNN Los Nevados:

```json
{
  "rutas": [
    {
      "id": "brisas-valle-tumbas",
      "nombre": "Corredor Brisas – Valle de las Tumbas",
      "sector": "Norte (Villamaría / Manizales, Caldas)",
      "altitud_rango": "4.100 - 4.450 m s.n.m.",
      "distancia_km": 4.5,
      "dificultad": "Media-Alta (Exigencia por altitud)",
      "estaciones": [
        "Aguacerales (4.180 m): Transición a superpáramo y afloramientos hídricos.",
        "Arenales (4.230 m): Dunas de arena volcánica moldeadas por el viento.",
        "Valle Lunar (4.300 m): Paisaje volcánico de baja vegetación.",
        "Valle de las Tumbas (4.450 m): Punto máximo autorizado por seguridad volcánica frente al Volcán Nevado del Ruiz (Kumanday)."
      ],
      "reglas": "Ingreso de 8:00 a.m. a 2:00 p.m. Obligatorio guía avalado. Prohibido menores de 6 años."
    },
    {
      "id": "cisne-laguna-verde",
      "nombre": "Travesía Cisne – Laguna Verde (Poleka Kasue)",
      "sector": "Caldas / Tolima",
      "altitud_rango": "3.900 - 4.650 m s.n.m.",
      "distancia_km": 6.2,
      "dificultad": "Alta",
      "estaciones": [
        "Humedales de altura: Colchones de agua y turberas.",
        "Laguna Verde: Cuerpo de agua glaciar con tonalidad esmeralda por minerales.",
        "Borde Paramillo del Cisne: Vista al Nevado Santa Isabel."
      ],
      "reglas": "Requiere reserva con 3 días hábiles de anticipación. Prohibido salirse del sendero."
    },
    {
      "id": "potosi-laguna-otun",
      "nombre": "Sendero Potosí – Laguna del Otún",
      "sector": "Occidental (Caldas / Risaralda)",
      "altitud_rango": "3.950 - 4.150 m s.n.m.",
      "distancia_km": 5.0,
      "dificultad": "Media",
      "estaciones": [
        "Bosque de Frailejones: Densidad alta de Espeletia hartwegiana.",
        "Mirador Laguna del Otún: Complejo lagunar Ramsar, fábrica de agua del Eje Cafetero."
      ],
      "reglas": "Prohibida la pesca, fogatas y drones."
    }
  ],
  "pisos_termicos": [
    {
      "piso": "Bosque Altoandino",
      "min_m": 2300,
      "max_m": 3200,
      "temp": "10°C - 14°C",
      "descripcion": "Selva de niebla con árboles retorcidos, musgos y transición hacia la palma de cera.",
      "especies_clave": ["Oso de anteojos", "Loro orejiamarillo", "Palma de cera"]
    },
    {
      "piso": "Subpáramo",
      "min_m": 3201,
      "max_m": 3500,
      "temp": "7°C - 10°C",
      "descripcion": "Arbustos bajos, romeros de páramo y mortiños; zona de alta actividad de polinizadores.",
      "especies_clave": ["Romero de páramo", "Chivito de páramo", "Danta de montaña"]
    },
    {
      "piso": "Páramo Propiamente Dicho",
      "min_m": 3501,
      "max_m": 4100,
      "temp": "4°C - 7°C",
      "descripcion": "Fábrica de agua dominada por frailejonales, pajonales y turberas esponjosas.",
      "especies_clave": ["Frailejón del Ruiz", "Chivito de páramo", "Pato andino"]
    },
    {
      "piso": "Superpáramo",
      "min_m": 4101,
      "max_m": 4800,
      "temp": "0°C - 3°C",
      "descripcion": "Tundra alpina de arenas volcánicas, líquenes y plantas almohadilla antes del glaciar.",
      "especies_clave": ["Cacho de venado", "Cóndor de los Andes", "Líquenes crustáceos"]
    }
  ],
  "especies": [
    {
      "nombre_comun": "Frailejón del Ruiz",
      "nombre_cientifico": "Espeletia hartwegiana",
      "tipo": "Flora",
      "estado": "Especie Clave • Protegida",
      "rol_ecologico": "Sus hojas vellosas atrapan gotas de la neblina y regulan el agua que abastece a Caldas y el Eje Cafetero. Refugia hasta 150 especies.",
      "alerta_conservacion": "No tocar ni arrancar sus hojas secas; son su abrigo térmico contra el congelamiento nocturno."
    },
    {
      "nombre_comun": "Chivito de Páramo (Barbudito Canelo)",
      "nombre_cientifico": "Oxypogon stubelii",
      "tipo": "Fauna",
      "estado": "Endémico PNN Los Nevados • Vulnerable",
      "rol_ecologico": "Colibrí exclusivo de los páramos del Nevado del Ruiz. Se posa en las flores de frailejón para ahorrar energía y usa su lana para hacer nidos.",
      "alerta_conservacion": "Observar en silencio a distancia. Prohibido el uso de flash."
    },
    {
      "nombre_comun": "Cóndor de los Andes",
      "nombre_cientifico": "Vultur gryphus",
      "tipo": "Fauna",
      "estado": "En Peligro",
      "rol_ecologico": "Carroñero supremo que mantiene limpio el ecosistema de alta montaña.",
      "alerta_conservacion": "No dejar ningún residuo orgánico ni basura en la montaña."
    },
    {
      "nombre_comun": "Oso de Anteojos",
      "nombre_cientifico": "Tremarctos ornatus",
      "tipo": "Fauna",
      "estado": "Vulnerable",
      "rol_ecologico": "Jardinero del bosque altoandino y páramo; dispersa semillas y abre claros en la vegetación.",
      "alerta_conservacion": "Mantener distancia segura y reportar avistamientos a guardaparques al descender."
    }
  ],
  "protocolos_vida": {
    "soroche": {
      "titulo": "Protocolo Mal Agudo de Montaña (Soroche)",
      "sintomas": ["Dolor de cabeza pulsátil", "Náuseas o vómito", "Mareo intenso", "Fatiga extrema o falta de aire en reposo"],
      "accion_inmediata": "1. DETENER el ascenso inmediatamente. 2. Hidratarse con pequeños sorbos de agua. 3. DESCENDER al menos 500 metros de altitud acompañado. 4. Notificar al guía o puesto de control Brisas/Potosí."
    },
    "hipotermia": {
      "titulo": "Protocolo Prevención de Hipotermia",
      "sintomas": ["Temblores incontrolables", "Torpeza en manos", "Habla arrastrada o confusión"],
      "accion_inmediata": "1. Refugiar del viento. 2. Cambiar ropa húmeda por prendas secas (sistema 3 capas). 3. Dar bebidas tibias azucaradas si está consciente. 4. Descender de inmediato."
    }
  }
}
```

---

## 🎨 3. GUÍA DE DISEÑO UI/UX (ESTÉTICA ALTA MONTAÑA)

* **Paleta de Colores (`tailwind.config.js`):**
  * `mist`: `#F4F7F6` (Fondo principal limpio y luminoso).
  * `frailejon`: `#2C5545` (Primario - verde musgo profundo).
  * `paramo-earth`: `#8C7A6B` (Secundario - tierra/roca volcánica).
  * `mountain-ink`: `#1E293B` (Texto principal de alto contraste).
  * `life-alert`: `#D97706` (Ámbar de seguridad / alertas de conservación y salud).
* **Layout Mobile-First:** Contenedor centrado `max-w-md mx-auto min-h-screen bg-mist shadow-2xl relative pb-24` (para que en la demo de escritorio luzca exactamente como una app móvil nativa).
* **Componentes Clave:**
  1. **Header:** Logo minimalista de montaña + título "PNN Los Nevados" + píldora verde **"Sin Señal • IA Local Activa"**.
  2. **Botón Flotante "Protegiendo la Vida" (SOS Altura):** Siempre accesible en la parte superior o barra rápida; abre el triaje interactivo de Soroche, Hipotermia y Reglas Volcánicas.
  3. **Vista 1 - Rutas & Radar GPS:**
     * Tarjeta *Glassmorphism* de **Radar GPS por Altitud**: permite usar el GPS real del navegador (`navigator.geolocation`) **Y** tiene un **slider de altitud simulada (2.500 m a 4.600 m)** (vital para demostrar en la hackatón cómo cambia el ecosistema y las especies sugeridas al subir la montaña).
     * Lista de las 3 rutas oficiales del PNNN con botón de descarga offline (`Descargado ✓`) y vista de detalle con estaciones.
  4. **Vista 2 - Lente de Páramo (Visión IA):**
     * Permite subir una foto o usar la cámara del dispositivo.
     * Envía la imagen en base64 al backend `/api/vision` (que consulta a Ollama multimodal) y muestra la ficha científica + alerta de conservación. Incluye botones de "Fotos de prueba rápidas" por si en el escenario no hay una planta a la mano.
  5. **Vista 3 - Guía Científico (Chat RAG Offline):**
     * Chat rápido conectado a `/api/chat`.
     * Chips de preguntas rápidas: *"¿Cómo produce agua el frailejón?"*, *"Tengo dolor de cabeza a 4.200 m"*, *"¿Qué aves viven aquí?"*.

---

## ⚙️ 4. SECUENCIA DE EJECUCIÓN PARA ANTIGRAVITY

Ejecuta estos pasos ahora mismo:

### Fase 1: Inicialización y Backend (FastAPI + Ollama)
1. Crea la carpeta `backend` y `backend/data`. Guarda `pnnn_knowledge.json`.
2. Crea `requirements.txt` con: `fastapi`, `uvicorn`, `pydantic`, `requests`, `python-multipart`.
3. Instala las dependencias en un entorno virtual `venv`.
4. Verifica mediante terminal (`ollama list`) qué modelos están instalados localmente.
5. Implementa `backend/main.py` con CORS habilitado (`*`) y los endpoints:
   * `GET /api/health` (verifica conexión con Ollama local y devuelve modelos activos).
   * `GET /api/rutas` (devuelve catálogo del PNNN).
   * `GET /api/radar?altitud=4150` (calcula el piso térmico exacto y especies probables).
   * `POST /api/chat` (inyecta el contexto relevante de `pnnn_knowledge.json` en el prompt del sistema de Ollama y responde en máximo 3 párrafos concisos).
   * `POST /api/vision` (recibe imagen base64 y consulta al modelo de visión de Ollama para identificar flora/fauna de páramo).

### Fase 2: Frontend (React + Vite + Tailwind)
1. Inicializa el proyecto Vite en `/frontend` e instala `lucide-react` y Tailwind CSS.
2. Implementa toda la interfaz descrita en la Sección 3, asegurando **tolerancia a fallos**: si Ollama tarda o no está encendido aún, el frontend debe mostrar estados de carga elegantes y respaldarse en `offlineData.js` para que la app nunca se rompa en vivo.

### Fase 3: Verificación
1. Levanta el servidor FastAPI en el puerto `8000` y Vite en el puerto `5173`.
2. Prueba el endpoint `/api/health` y `/api/chat` con `curl` para confirmar que Ollama responde localmente sin internet.
3. Muéstrame los comandos exactos para iniciar ambos servicios y exponerlos si es necesario.