# ESPECIFICACIONES DE DISEÑO UI/UX: GUÍA DE PÁRAMO

**Estilo General:** Minimalista, natural, limpio (Clean UI). Inspirado en la alta montaña caldense. Alto contraste para legibilidad en exteriores. Componentes con bordes redondeados suaves y sombras sutiles.

## 1. PALETA DE COLORES (Tailwind Config)
El agente debe configurar estos colores en el `tailwind.config.js`:

*   **Fondo Principal (Niebla):** `#F4F7F6` (Un gris/blanco muy tenue, casi frío).
*   **Color Primario (Verde Frailejón):** `#2C5545` (Verde oscuro, elegante, para botones principales y encabezados).
*   **Color Secundario (Tierra/Roca):** `#8C7A6B` (Marrón suave para íconos secundarios o bordes).
*   **Texto Principal (Carbón):** `#1E293B` (Gris muy oscuro, evita el negro puro para no cansar la vista).
*   **Acentos (Sol de Montaña):** `#EAB308` (Un amarillo ámbar para alertas o insignias de "Recomendado").

## 2. TIPOGRAFÍA
*   **Fuente principal:** `Inter` o `Geist` (Importar desde Google Fonts).
*   **Jerarquía:** Títulos en `font-semibold` o `font-bold` (ej. 24px/32px). Textos de párrafo en `font-normal` (ej. 16px para legibilidad).

---

## 3. DESCRIPCIÓN DE MOCKUPS (Pantallas para el Frontend)

Instrucciones para el agente: Construye estas tres vistas principales usando componentes funcionales de React y Tailwind CSS.

### MOCKUP 1: Pantalla de Inicio / Exploración (Home)
**Propósito:** Dar la bienvenida y mostrar las rutas o puntos de interés.
*   **Header (Superior):** 
    *   Saludo sutil: "Buen día, Explorador".
    *   Ícono minimalista de una montaña (usar `lucide-react`).
    *   Indicador de estado: Un pequeño punto verde que diga "Modo Offline Activo".
*   **Sección Hero:**
    *   Tarjeta grande (Card) con bordes redondeados (`rounded-2xl`). 
    *   Fondo con un gradiente suave o una imagen de un frailejón oscurecida.
    *   Texto sobre la tarjeta: "Ruta Laguna Verde - A 2.3 km de ti". Botón: "Iniciar recorrido".
*   **Catálogo (Scroll Horizontal):**
    *   Título: "Especies cercanas" o "Descubre el entorno".
    *   Pequeñas tarjetas cuadradas (`w-32 h-32`) con imágenes ilustrativas (o íconos) de: Frailejón, Cóndor, Oso de Anteojos, Líquenes.
*   **Bottom Navigation (Barra inferior flotante):**
    *   Menú estilo "píldora" flotante en la parte inferior de la pantalla con 3 íconos: Inicio (Casa), Identificador (Cámara), Guía IA (Mensaje).

### MOCKUP 2: Lente de Páramo (Identificador por Cámara)
**Propósito:** Interfaz para que el usuario tome una foto a una planta/animal y la IA la analice.
*   **Fondo:** Oscuro (`bg-black` o feed de la cámara si es posible simularlo).
*   **Área de enfoque:** Un marco blanco delgado en el centro con esquinas marcadas (estilo visor de cámara).
*   **Botón de Acción:** Un botón circular grande en la parte inferior, color *Verde Frailejón*, con un ícono de cámara adentro.
*   **Tarjeta de Resultado (Bottom Sheet):** 
    *   Cuando se toma la foto, una tarjeta blanca desliza desde abajo (`rounded-t-3xl`).
    *   Contenido: Título de la especie identificada, una etiqueta de "Endémica" (en color acento) y un párrafo corto generado por la IA explicando su importancia.

### MOCKUP 3: Chatbot Guía Local (Asistente RAG)
**Propósito:** Interfaz de mensajería limpia para conversar con el modelo de lenguaje.
*   **Header:** Botón de "Atrás" a la izquierda. En el centro: "Guía de Páramo" con un avatar de un guardabosques o una hoja.
*   **Área de mensajes:** 
    *   Fondo color *Niebla* (`#F4F7F6`).
    *   Burbujas del usuario: Fondo *Verde Frailejón*, texto blanco, alineadas a la derecha. Bordes redondeados excepto la esquina inferior derecha.
    *   Burbujas de la IA: Fondo blanco, texto *Carbón*, alineadas a la izquierda, con un sutil `shadow-sm`.
*   **Input Box:**
    *   Barra de escritura fija en la base, blanca, con bordes redondeados.
    *   Botón de enviar circular.
    *   (Bonus UI): Un pequeño ícono de micrófono al lado del input para indicar futuras funciones de voz.

## 4. CONSIDERACIONES UX PARA LA HACKATÓN
*   **Feedback visual:** Añadir *spinners* o animaciones de "pensando" (esqueletos de carga) cuando el modelo de IA local esté procesando una respuesta o analizando una imagen (ya que los modelos locales pueden tardar 2-5 segundos).
*   **Tap Targets:** Los botones deben ser grandes (mínimo `44x44 px`) pensando en que el usuario podría tener guantes delgados o las manos frías en la alta montaña.