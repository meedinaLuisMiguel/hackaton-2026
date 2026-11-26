"""Kumanday AI Agent orchestrator, strict image validation, and Ollama integration."""

import base64
import io
import json
import re
import unicodedata
from typing import Literal

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

from backend.config import Settings
from backend.knowledge import calculate_radar, load_knowledge
from backend.schemas import (
    ChatRequest,
    ChatResponse,
    Especie,
    KnowledgeBase,
    VisionRequest,
    VisionResponse,
)

ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_RAW_IMAGE_BYTES = 8 * 1024 * 1024
MIN_IMAGE_DIM = 32
VISION_MAX_DIM = 512

SAFETY_KEYWORDS = (
    "dolor de cabeza",
    "soroche",
    "mareo",
    "nausea",
    "vomito",
    "hipotermia",
    "temblor",
    "frio extremo",
    "falta de aire",
    "emergencia",
    "auxilio",
    "sos",
    "volcan",
    "ceniza",
    "azufre",
    "rescate",
    "evacuacion",
)

DOMAIN_KEYWORDS = (
    "paramo",
    "nevado",
    "ruiz",
    "kumanday",
    "santa isabel",
    "tolima",
    "caldas",
    "risaralda",
    "otun",
    "brisas",
    "tumbas",
    "cisne",
    "laguna",
    "ruta",
    "sendero",
    "caminata",
    "trekking",
    "altitud",
    "altura",
    "metro",
    "msnm",
    "piso",
    "clima",
    "frio",
    "neblina",
    "agua",
    "turbera",
    "frailejon",
    "espeletia",
    "chivito",
    "colibri",
    "condor",
    "oso",
    "anteojos",
    "danta",
    "tapir",
    "loro",
    "palma",
    "pato",
    "romero",
    "cacho",
    "zorro",
    "musgo",
    "sphagnum",
    "ave",
    "flora",
    "fauna",
    "especie",
    "animal",
    "planta",
    "parque",
    "guia",
    "guardaparque",
    "regla",
    "reserva",
    "horario",
    "ropa",
    "capa",
    "hidratacion",
    "hola",
    "buenos",
    "buenas",
    "quien eres",
    "ayuda",
    "gracias",
)

NON_PNNN_SUBJECT_KEYWORDS = (
    "tigre",
    "tiger",
    "leon",
    "lion",
    "leopardo",
    "leopard",
    "jaguar",
    "pantera",
    "guepardo",
    "cheetah",
    "elefante",
    "jirafa",
    "cebra",
    "rinoceronte",
    "hipopotamo",
    "canguro",
    "koala",
    "pinguino",
    "perro",
    "cachorro",
    "gato",
    "minino",
    "caballo",
    "vaca",
    "cerdo",
    "gallina",
    "vehiculo",
    "carro",
    "automovil",
    "moto",
    "edificio",
    "computador",
    "laptop",
    "celular",
    "telefono",
)


def _normalize_text(text: str) -> str:
    """Lowercase and strip Spanish accents for deterministic keyword matching."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


def _tokenize(text: str) -> set[str]:
    return {tok for tok in re.findall(r"[a-z0-9]{3,}", _normalize_text(text))}


def _is_greeting_only(norm_query: str) -> bool:
    greetings = ("hola", "buenos dias", "buenas tardes", "buenas noches", "quien eres", "ayuda")
    tokens = norm_query.split()
    return len(tokens) <= 5 and any(g in norm_query for g in greetings)


def _is_in_domain(request: ChatRequest, kb: KnowledgeBase) -> bool:
    """Verify the prompt belongs to PNN Los Nevados ecology, trails, or mountain safety."""
    norm = _normalize_text(request.message)
    if any(kw in norm for kw in SAFETY_KEYWORDS) or any(kw in norm for kw in DOMAIN_KEYWORDS):
        return True
    # Explicit route context from UI actions is valid grounding for short/ambiguous prompts.
    if request.ruta_id and any(route.id == request.ruta_id for route in kb.rutas):
        return True
    if request.last_species:
        target = _normalize_text(request.last_species)
        if any(
            target in _normalize_text(f"{sp.nombre_comun} {sp.nombre_cientifico} {sp.id}")
            for sp in kb.especies
        ):
            return True
    # History is context for grounded answers, never evidence that a new query belongs
    # to the park. Short unrelated messages must still hit the domain guardrail.
    q_tokens = _tokenize(request.message)
    for sp in kb.especies:
        if q_tokens & _tokenize(f"{sp.nombre_comun} {sp.nombre_cientifico}"):
            return True
    return False


def _execute_agent_tools(
    request: ChatRequest,
    kb: KnowledgeBase,
) -> tuple[
    str,
    list[str],
    list[str],
    bool,
    Literal["none", "open_safety", "open_rutas", "open_vision"],
]:
    """Execute deterministic local tools to ground Kumanday before synthesis."""
    norm_query = _normalize_text(request.message)
    q_tokens = _tokenize(request.message)
    safety_alert = any(kw in norm_query for kw in SAFETY_KEYWORDS)

    observations: list[str] = []
    sources: list[str] = []
    tools_used: list[str] = []
    suggested_action: Literal["none", "open_safety", "open_rutas", "open_vision"] = "none"

    # Tool 1: Radar de Altitud
    if request.altitud_m is not None:
        radar = calculate_radar(request.altitud_m)
        tools_used.append("consultar_radar_altitud")
        observations.append(
            f"[HERRAMIENTA: consultar_radar_altitud({request.altitud_m}m)] "
            f"Piso térmico: {radar.piso_termico.piso} ({radar.piso_termico.temp}). "
            f"Riesgo de soroche: {radar.riesgo_soroche}. "
            f"Recomendación: {radar.recomendacion_seguridad} "
            f"Especies esperadas: {', '.join(sp.nombre_comun for sp in radar.especies_probables[:4])}."
        )
        sources.append(f"Radar ({radar.piso_termico.piso})")

    # Tool 2: Protocolos de Vida & Emergencias
    if safety_alert:
        tools_used.append("activar_protocolo_vida")
        suggested_action = "open_safety"
        for key, proto in kb.protocolos_vida.items():
            observations.append(
                f"[HERRAMIENTA: activar_protocolo_vida({key})] {proto.titulo} | "
                f"Síntomas: {', '.join(proto.sintomas)}. "
                f"Acción inmediata: {proto.accion_inmediata}"
            )
            sources.append(f"Protocolo {key.capitalize()}")
        emerg = kb.directorio_emergencias[0]
        observations.append(
            f"[CONTACTO PRIORITARIO] {emerg.entidad} ({emerg.canal}): {emerg.telefono_display}."
        )

    # Tool 3: Catálogo de Especies (12 especies verificadas)
    scored_species: list[tuple[int, Especie]] = []
    last_sp_norm = _normalize_text(request.last_species or "")
    for sp in kb.especies:
        haystack = (
            f"{sp.id} {sp.nombre_comun} {sp.nombre_cientifico} "
            f"{sp.tipo} {sp.rol_ecologico} {sp.alerta_conservacion}"
        )
        score = len(q_tokens & _tokenize(haystack))
        if any(w in norm_query for w in _tokenize(sp.nombre_comun)):
            score += 4
        if last_sp_norm and (
            _normalize_text(sp.nombre_comun) in last_sp_norm or sp.id in last_sp_norm
        ):
            score += 3
        if "agua" in norm_query and sp.id in ("frailejon", "musgo"):
            score += 3
        if ("ave" in norm_query or "pajaro" in norm_query or "colibri" in norm_query) and sp.id in (
            "chivito",
            "condor",
            "loro",
            "pato",
        ):
            score += 3
        if score > 0:
            scored_species.append((score, sp))

    scored_species.sort(key=lambda item: item[0], reverse=True)
    if scored_species:
        tools_used.append("consultar_especie")
        for _, sp in scored_species[:3]:
            observations.append(
                f"[HERRAMIENTA: consultar_especie({sp.id})] {sp.nombre_comun} ({sp.nombre_cientifico}) | "
                f"Tipo: {sp.tipo} | Estado: {sp.estado} | Pisos: {', '.join(sp.pisos)}. "
                f"Rol: {sp.rol_ecologico} Conservación: {sp.alerta_conservacion}"
            )
            if sp.nombre_comun not in sources:
                sources.append(sp.nombre_comun)

    # Tool 4: Rutas Oficiales
    scored_routes = []
    for ruta in kb.rutas:
        haystack = f"{ruta.id} {ruta.nombre} {ruta.sector} {' '.join(ruta.estaciones)} {ruta.reglas}"
        score = len(q_tokens & _tokenize(haystack))
        if request.ruta_id and ruta.id == request.ruta_id:
            score += 5
        if any(w in norm_query for w in ("ruta", "sendero", "horario", "regla", "caminata")):
            score += 1
        if score > 0:
            scored_routes.append((score, ruta))

    scored_routes.sort(key=lambda item: item[0], reverse=True)
    route_question = any(w in norm_query for w in ("ruta", "sendero", "estacion", "horario", "regla", "ingreso", "recorrido", "caminata", "brisas", "otun", "cisne", "tumbas"))
    if scored_routes and route_question:
        tools_used.append("consultar_ruta")
        if suggested_action == "none":
            suggested_action = "open_rutas"
        for _, ruta in scored_routes[:2]:
            observations.append(
                f"[HERRAMIENTA: consultar_ruta({ruta.id})] {ruta.nombre} ({ruta.sector}, {ruta.altitud_rango}, "
                f"{ruta.distancia_km} km, dificultad {ruta.dificultad}). "
                f"Estaciones: {'; '.join(ruta.estaciones)}. Reglas: {ruta.reglas}"
            )
            if ruta.nombre not in sources:
                sources.append(ruta.nombre)

    if not scored_species and not scored_routes and not safety_alert:
        observations.append(
            "[BASE PNNN] El parque abarca 4 pisos térmicos (2.300 a 4.800 m), 3 corredores oficiales "
            "(Brisas–Valle de las Tumbas, Cisne–Laguna Verde, Potosí–Laguna del Otún) y 12 especies clave protegidas."
        )
        sources.append("Base Científica PNN Los Nevados")

    return "\n".join(observations), sources, tools_used, safety_alert, suggested_action


def _constrain_chat_reply(reply: str) -> str:
    """Enforce the agent's user-facing length and bullet limits on model output."""
    text = reply.strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    kept: list[str] = []
    bullets = 0
    for line in lines:
        if line.startswith(("•", "- ", "* ")):
            bullets += 1
            if bullets > 2:
                continue
        kept.append(line)
    text = "\n".join(kept)
    words = text.split()
    if len(words) > 110:
        text = " ".join(words[:110]).rstrip(" ,;:") + "…"
    return text


def _build_offline_agent_reply(
    request: ChatRequest,
    kb: KnowledgeBase,
    safety_alert: bool,
) -> str:
    """Build a crisp, non-rambling structured reply from verified tools when Ollama is offline."""
    norm_query = _normalize_text(request.message)
    if _is_greeting_only(norm_query):
        alt = request.altitud_m or 4150
        radar = calculate_radar(alt)
        return (
            f"Hola, soy **Kumanday**, tu Agente Guardaparques del PNN Los Nevados (activo a {alt:,} m s.n.m., "
            f"piso {radar.piso_termico.piso}).\n\n"
            "• Puedo orientarte sobre nuestras 12 especies nativas, las 3 rutas oficiales y protocolos de vida.\n"
            "• Si tienes algún síntoma de altura o frío, indícamelo de inmediato."
        ).replace(",", ".")

    if safety_alert:
        if any(w in norm_query for w in ("hipotermia", "temblor", "frio")):
            proto = kb.protocolos_vida["hipotermia"]
        elif any(w in norm_query for w in ("volcan", "ceniza", "azufre")):
            proto = kb.protocolos_vida["volcanico"]
        else:
            proto = kb.protocolos_vida["soroche"]

        emerg = kb.directorio_emergencias[0]
        alt_txt = f" a {request.altitud_m} m s.n.m." if request.altitud_m is not None else ""
        return (
            f"**Alerta prioritaria{alt_txt} — {proto.titulo}:**\n"
            f"{proto.accion_inmediata}\n\n"
            f"• **Contacto:** {emerg.entidad} ({emerg.canal} / {emerg.telefono_display})."
        )

    q_tokens = _tokenize(request.message)
    best_sp: Especie | None = None
    best_score = 0
    for sp in kb.especies:
        score = len(
            q_tokens & _tokenize(f"{sp.nombre_comun} {sp.nombre_cientifico} {sp.rol_ecologico}")
        )
        if "agua" in norm_query and sp.id == "frailejon":
            score += 3
        if ("ave" in norm_query or "colibri" in norm_query) and sp.id == "chivito":
            score += 3
        if score > best_score:
            best_score = score
            best_sp = sp

    if best_sp is not None:
        return (
            f"**{best_sp.nombre_comun}** (*{best_sp.nombre_cientifico}* — {best_sp.estado}): "
            f"{best_sp.rol_ecologico}\n\n"
            f"• **Conservación:** {best_sp.alerta_conservacion}"
        )

    if any(w in norm_query for w in ("ruta", "sendero", "tumbas", "brisas", "otun", "laguna", "regla")):
        ruta = kb.rutas[0]
        for r in kb.rutas:
            if any(tok in _normalize_text(r.nombre) for tok in q_tokens):
                ruta = r
                break
        return (
            f"**{ruta.nombre}** ({ruta.sector}, {ruta.altitud_rango}, {ruta.distancia_km} km):\n"
            f"• **Reglas:** {ruta.reglas}\n"
            f"• **Estación clave:** {ruta.estaciones[0]}"
        )

    alt = request.altitud_m if request.altitud_m is not None else 4150
    radar = calculate_radar(alt)
    return (
        f"A {alt} m s.n.m. estás en **{radar.piso_termico.piso}** ({radar.piso_termico.temp}): "
        f"{radar.piso_termico.descripcion}\n\n"
        f"• **Especies probables:** {', '.join(sp.nombre_comun for sp in radar.especies_probables[:4])}.\n"
        f"• **Seguridad:** {radar.recomendacion_seguridad}"
    )


async def _post_to_ollama(
    url: str,
    payload: dict[str, object],
    timeout: float,
    http_client: httpx.AsyncClient | None = None,
) -> dict[str, object]:
    """Send an async JSON POST request to the local Ollama HTTP API reusing a pooled client."""
    if http_client is not None:
        resp = await http_client.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {}

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {}


async def list_ollama_models(
    settings: Settings,
    http_client: httpx.AsyncClient | None = None,
) -> tuple[bool, list[str]]:
    """Query Ollama /api/tags to check connectivity and installed models."""
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        if http_client is not None:
            resp = await http_client.get(url, timeout=3.0)
            resp.raise_for_status()
            payload = resp.json()
        else:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                payload = resp.json()
        models = [m.get("name", "") for m in payload.get("models", []) if m.get("name")]
        return True, models
    except (httpx.HTTPError, ValueError):
        return False, []


async def generate_chat_response(
    request: ChatRequest,
    settings: Settings,
    http_client: httpx.AsyncClient | None = None,
) -> ChatResponse:
    """Run Kumanday Agent: domain guardrail, deterministic tool execution, and concise synthesis."""
    kb = load_knowledge()

    if not _is_in_domain(request, kb):
        general_prompt = (
            "Eres Kumanday, guía inteligente del Parque Nacional Natural Los Nevados. Responde la pregunta "
            "del usuario con autonomía, de forma directa, veraz y breve en español (máximo 90 palabras). "
            "Si no sabes, dilo. Al final agrega una sola frase natural indicando que tu especialidad es "
            "Los Nevados y ofrece ayuda relacionada con rutas, biodiversidad, altitud o seguridad. "
            "No inventes datos ni fuerces la respuesta a hablar del parque."
        )
        try:
            data = await _post_to_ollama(
                f"{settings.ollama_base_url.rstrip('/')}/api/chat",
                {
                    "model": settings.ollama_model,
                    "messages": [
                        {"role": "system", "content": general_prompt},
                        *[{"role": turn.role, "content": turn.content} for turn in request.history[-2:]],
                        {"role": "user", "content": request.message},
                    ],
                    "stream": False,
                    "keep_alive": "15m",
                    "options": {"temperature": 0.25, "num_ctx": 2048, "num_predict": 160},
                },
                settings.ollama_timeout_seconds,
                http_client=http_client,
            )
            message_obj = data.get("message")
            reply = str(message_obj.get("content", "")).strip() if isinstance(message_obj, dict) else ""
            if reply:
                return ChatResponse(
                    agent_name="Kumanday",
                    reply=_constrain_chat_reply(reply),
                    sources=["Respuesta general · IA local"],
                    tools_used=["consulta_general"],
                    suggested_action="none",
                    out_of_domain=True,
                    model=settings.ollama_model,
                    fallback_used=False,
                    safety_alert=False,
                )
        except (httpx.HTTPError, ValueError):
            pass

        return ChatResponse(
            agent_name="Kumanday",
            reply=(
                "No pude responder esa pregunta porque el modelo local no está disponible ahora. "
                "Mi especialidad es Los Nevados: rutas, biodiversidad, altitud y seguridad en montaña."
            ),
            sources=["Alcance de Kumanday"],
            tools_used=["consulta_general"],
            suggested_action="none",
            out_of_domain=True,
            model="kumanday-router",
            fallback_used=True,
            safety_alert=False,
        )

    norm_query = _normalize_text(request.message)
    if _is_greeting_only(norm_query):
        return ChatResponse(
            agent_name="Kumanday",
            reply=_build_offline_agent_reply(request, kb, safety_alert=False),
            sources=["Kumanday • Guardaparques IA"],
            tools_used=["consultar_radar_altitud"] if request.altitud_m else [],
            suggested_action="none",
            out_of_domain=False,
            model="kumanday-router",
            fallback_used=False,
            safety_alert=False,
        )

    observations, sources, tools_used, safety_alert, _suggested_action = _execute_agent_tools(request, kb)
    route_question = any(word in norm_query for word in (
        "ruta", "sendero", "estacion", "horario", "regla", "ingreso", "recorrido", "caminata", "brisas", "otun", "cisne", "tumbas"
    ))

    species_context = (
        f"\nESPECIE RECIÉN ESCANEADA POR EL USUARIO: {request.last_species}"
        if request.last_species
        else ""
    )

    system_prompt = (
        "Eres Kumanday, el Agente Guardaparques e Intérprete Científico del Parque Nacional Natural Los Nevados (Colombia).\n"
        "REGLAS ESTRICTAS DE RESPUESTA:\n"
        "1. Usa ÚNICAMENTE los datos verificados de las HERRAMIENTAS EJECUTADAS abajo. Prohibido inventar datos, cifras o especies.\n"
        "2. NO divagues ni saludes largo. Máximo 110 palabras en español.\n"
        "3. Formato exacto: 1 párrafo breve con la respuesta directa, seguido de máximo 2 viñetas (•) con el dato ecológico o acción práctica.\n"
        "4. Si hay riesgo médico o volcánico, prioriza la acción de seguridad humana.\n"
        "5. No sugieras abrir rutas si el usuario no pregunta por rutas.\n"
        "6. Responde preguntas generales con autonomía; si no tienes certeza, dilo y orienta brevemente a tu especialidad en Los Nevados.\n\n"
        f"OBSERVACIONES DE HERRAMIENTAS:\n{observations}{species_context}"
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for turn in request.history[-4:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": request.message})

    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    try:
        data = await _post_to_ollama(
            url,
            {
                "model": settings.ollama_model,
                "messages": messages,
                "stream": False,
                "keep_alive": "15m",
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.85,
                    "repeat_penalty": 1.15,
                    "num_ctx": 2048,
                    "num_predict": 220,
                },
            },
            settings.ollama_timeout_seconds,
            http_client=http_client,
        )
        message_obj = data.get("message")
        reply = (
            str(message_obj.get("content", "")).strip()
            if isinstance(message_obj, dict)
            else ""
        )
        if reply:
            reply = _constrain_chat_reply(reply)
            return ChatResponse(
                agent_name="Kumanday",
                reply=reply,
                sources=sources,
                tools_used=tools_used,
                suggested_action=("open_safety" if safety_alert else "open_rutas" if route_question else "none"),
                out_of_domain=False,
                model=settings.ollama_model,
                fallback_used=False,
                safety_alert=safety_alert,
            )
    except (httpx.HTTPError, ValueError):
        pass

    return ChatResponse(
        agent_name="Kumanday",
        reply=_build_offline_agent_reply(request, kb, safety_alert=safety_alert),
        sources=sources,
        tools_used=tools_used,
        suggested_action=("open_safety" if safety_alert else "open_rutas" if route_question else "none"),
        out_of_domain=False,
        model="offline-knowledge-base",
        fallback_used=True,
        safety_alert=safety_alert,
    )


def normalize_image_base64(raw_b64: str) -> str:
    """Strictly validate image MIME/format, fix EXIF orientation, and optimize for local vision."""
    cleaned = raw_b64.strip()
    declared_mime: str | None = None
    if cleaned.startswith("data:"):
        header, _, payload = cleaned.partition(",")
        if not payload:
            raise ValueError("El formato data URL de la imagen está incompleto.")
        mime_part = header[5:].split(";", 1)[0].lower()
        if mime_part not in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
            raise ValueError(
                "Formato no permitido. Solo se aceptan imágenes JPG, PNG o WebP."
            )
        cleaned = payload
        declared_mime = "image/jpeg" if mime_part == "image/jpg" else mime_part

    try:
        image_bytes = base64.b64decode(cleaned, validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError("La imagen base64 no es válida.") from exc

    if not image_bytes:
        raise ValueError("El archivo de imagen está vacío.")
    if len(image_bytes) > MAX_RAW_IMAGE_BYTES:
        raise ValueError("La imagen supera el límite máximo permitido de 8 MB.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img_format = (img.format or "").upper()
            if img_format not in ALLOWED_IMAGE_FORMATS:
                raise ValueError(
                    "Formato de archivo no soportado. Usa únicamente imágenes JPG, PNG o WebP."
                )
            actual_mime = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}[img_format]
            if declared_mime is not None and declared_mime != actual_mime:
                raise ValueError("El formato declarado no coincide con el contenido real de la imagen.")
            width, height = img.size
            if width < MIN_IMAGE_DIM or height < MIN_IMAGE_DIM:
                raise ValueError("La imagen es demasiado pequeña para análisis visual (mínimo 32x32 px).")

            transposed = ImageOps.exif_transpose(img)
            rgb = transposed.convert("RGB")
            rgb.thumbnail((VISION_MAX_DIM, VISION_MAX_DIM))
            out = io.BytesIO()
            rgb.save(out, format="JPEG", quality=82, optimize=True)
            return base64.b64encode(out.getvalue()).decode("ascii")
    except ValueError:
        raise
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("El archivo enviado no corresponde a una imagen raster válida.") from exc


def _extract_json_block(text: str) -> dict[str, object] | None:
    """Parse JSON object from an LLM response safely."""
    try:
        direct = json.loads(text)
        if isinstance(direct, dict):
            return {str(k): v for k, v in direct.items()}
    except ValueError:
        pass

    fenced = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not fenced:
        return None
    try:
        parsed = json.loads(fenced.group(0))
        if isinstance(parsed, dict):
            return {str(k): v for k, v in parsed.items()}
    except ValueError:
        return None
    return None


def _contains_non_pnnn_subject(text: str) -> bool:
    """Detect animals/objects known not to inhabit PNN Los Nevados to block false positives."""
    tokens = _tokenize(text)
    return any(kw in tokens for kw in NON_PNNN_SUBJECT_KEYWORDS)


async def analyze_species_image(
    request: VisionRequest,
    settings: Settings,
    http_client: httpx.AsyncClient | None = None,
) -> VisionResponse:
    """Identify image objectively via Ollama vision, rejecting non-PNNN species like tigers."""
    clean_b64 = normalize_image_base64(request.image_base64)
    kb = load_knowledge()
    species_by_id = {sp.id: sp for sp in kb.especies}

    catalog_ids = ", ".join(f"{sp.id} ({sp.nombre_comun})" for sp in kb.especies)
    alt_context = (
        f"Contexto de altitud del dispositivo: {request.altitud_m} m s.n.m. "
        if request.altitud_m is not None
        else ""
    )

    prompt = (
        "Eres el módulo visual de Kumanday, agente del PNN Los Nevados. Describe objetivamente la imagen "
        "que envió el usuario, aunque su contenido no pertenezca al parque. Si es ajena al parque, "
        "identifícala con prudencia y agrega una frase breve y amable: puedes reconocer objetos, "
        "aunque tu especialidad es la biodiversidad y orientación del PNN Los Nevados. "
        f"{alt_context}\n"
        "REGLA CRÍTICA DE VERACIDAD:\n"
        "1. Primero identifica OBJETIVAMENTE qué aparece en la imagen (ejemplo: tigre, perro, gato, carro, persona, frailejón, cóndor, oso de anteojos, paisaje, etc.).\n"
        "2. NUNCA fuerces un animal exótico, felino (como tigre o león) o mascota doméstica para que parezca un Oso de Anteojos ni otra especie del parque.\n"
        f"3. Solo marca es_especie_pnnn=true si realmente corresponde a una de estas especies nativas: {catalog_ids}.\n"
        "Responde EXCLUSIVAMENTE en JSON válido con esta estructura exacta:\n"
        '{"objeto_detectado": "nombre real en español", '
        '"es_especie_pnnn": true o false, '
        '"especie_id": "id exacto de la lista o ninguna", '
        '"categoria": "Flora|Fauna|Paisaje|No pertenece al PNNN", '
        '"confianza": "Alta|Media|Baja", '
        '"observacion": "Máximo 2 oraciones claras describiendo lo observado."}'
    )

    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    try:
        data = await _post_to_ollama(
            url,
            {
                "model": settings.ollama_vision_model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                        "images": [clean_b64],
                    }
                ],
                "format": "json",
                "stream": False,
                "keep_alive": "15m",
                "options": {
                    "temperature": 0.05,
                    "repeat_penalty": 1.15,
                    "num_predict": 220,
                },
            },
            settings.ollama_timeout_seconds,
            http_client=http_client,
        )
        message_obj = data.get("message")
        raw_reply = (
            str(message_obj.get("content", "")).strip()
            if isinstance(message_obj, dict)
            else ""
        )
        parsed = _extract_json_block(raw_reply)

        if parsed:
            objeto = str(parsed.get("objeto_detectado") or "Elemento observado").strip()
            observacion = str(parsed.get("observacion") or "").strip()
            especie_id = _normalize_text(str(parsed.get("especie_id") or "ninguna")).strip()
            confianza = str(parsed.get("confianza") or "Media").strip()
            raw_flag = parsed.get("es_especie_pnnn")
            is_pnnn = raw_flag is True or str(raw_flag).lower() == "true"
            category = _normalize_text(str(parsed.get("categoria") or "")).strip()
            categoria_fuera_de_ecosistema = category == "no pertenece al pnnn"
            is_environment = category == "paisaje"
            is_object = category in {"objeto", "objeto cotidiano", "elemento cotidiano"}

            # Guardrail: block false positives when the detected object is clearly outside PNNN.
            detected_outside = _contains_non_pnnn_subject(objeto)
            if detected_outside:
                is_pnnn = False

            matched = species_by_id.get(especie_id) if is_pnnn else None
            if matched is not None:
                return VisionResponse(
                    en_pnnn=True,
                    nombre_comun=matched.nombre_comun,
                    nombre_cientifico=matched.nombre_cientifico,
                    tipo=matched.tipo,
                    estado=matched.estado,
                    rol_ecologico=matched.rol_ecologico,
                    alerta_conservacion=matched.alerta_conservacion,
                    confianza=confianza,
                    descripcion_ia=observacion or matched.rol_ecologico,
                    model=settings.ollama_vision_model,
                    fallback_used=False,
                )

            if not is_pnnn and detected_outside:
                return VisionResponse(
                    en_pnnn=False,
                    nombre_comun=objeto,
                    nombre_cientifico="Objeto o elemento fuera del catálogo de especies del parque",
                    tipo="Fuera de Ecosistema",
                    estado="No pertenece al ecosistema del parque",
                    rol_ecologico="La imagen se reconoce fuera del catálogo de flora y fauna del PNN Los Nevados.",
                    alerta_conservacion="Puedo reconocer objetos cotidianos, aunque mi especialidad es la biodiversidad y orientación del PNN Los Nevados.",
                    confianza=confianza,
                    descripcion_ia=observacion
                    or f"En la imagen se observa: {objeto}.",
                    enfoque_notice=None,
                    model=settings.ollama_vision_model,
                    fallback_used=False,
                )

            if not is_pnnn and (is_object or categoria_fuera_de_ecosistema):
                return VisionResponse(
                    en_pnnn=False,
                    nombre_comun=objeto,
                    nombre_cientifico="Objeto o elemento fuera del catálogo de especies del parque",
                    tipo="Objeto",
                    estado="Elemento identificado; fuera del catálogo de especies",
                    rol_ecologico="Kumanday puede reconocer elementos de uso cotidiano, aunque su catálogo se centra en la biodiversidad del parque.",
                    alerta_conservacion="",
                    confianza=confianza,
                    descripcion_ia=observacion or f"En la imagen se observa: {objeto}.",
                    enfoque_notice="Puedo ayudarte con objetos cotidianos; mi especialidad es la biodiversidad y las rutas del PNN Los Nevados.",
                    model=settings.ollama_vision_model,
                    fallback_used=False,
                )

            # Unknown IDs, invalid categories, or model uncertainty are never converted
            # into a positive park identification.
            if not is_pnnn or not (categoria_fuera_de_ecosistema or is_environment):
                return VisionResponse(
                    en_pnnn=False,
                    nombre_comun="Identificación sin confirmar",
                    nombre_cientifico="Sin coincidencia en el catálogo PNN Los Nevados",
                    tipo="Sin Confirmación",
                    estado="Resultado no verificable",
                    rol_ecologico="El modelo no relacionó la observación con una especie validada del catálogo local.",
                    alerta_conservacion="No uses esta respuesta como identificación. Consulta las fichas verificadas del parque.",
                    confianza="Sin confirmación",
                    descripcion_ia=observacion or f"El modelo propuso '{objeto}', pero no se pudo validar con el catálogo.",
                    model=settings.ollama_vision_model,
                    fallback_used=True,
                )

            if is_environment:
                return VisionResponse(
                    en_pnnn=True,
                    nombre_comun="Entorno de alta montaña",
                    nombre_cientifico="Ecosistema PNN Los Nevados",
                    tipo="Entorno",
                    estado="Observación general sin identificación de especie",
                    rol_ecologico="Paisaje de alta montaña, páramo y ecosistema volcánico.",
                    alerta_conservacion="Permanece en el sendero demarcado y no recolectes material natural.",
                    confianza=confianza,
                    descripcion_ia=observacion or "La imagen muestra un paisaje del entorno de alta montaña.",
                    model=settings.ollama_vision_model,
                    fallback_used=False,
                )

            return VisionResponse(
                en_pnnn=False,
                nombre_comun="Identificación sin confirmar",
                nombre_cientifico="Sin coincidencia en el catálogo PNN Los Nevados",
                tipo="Sin Confirmación",
                estado="Resultado no verificable",
                rol_ecologico="No fue posible validar una especie nativa en el catálogo local.",
                alerta_conservacion="Consulta el catálogo verificado o vuelve a tomar la fotografía.",
                confianza="Sin confirmación",
                descripcion_ia=observacion or "No se obtuvo una identificación verificable.",
                model=settings.ollama_vision_model,
                fallback_used=True,
            )
    except (httpx.HTTPError, ValueError):
        pass

    # Deterministic offline fallback ONLY for verified local sample buttons (exact hint ID)
    hint_id = _normalize_text(request.hint or "").strip()
    # Hints are only for bundled demo samples, never user uploaded photos.
    hint_match = species_by_id.get(hint_id) if hint_id.startswith("sample:") else None
    if hint_match is None and hint_id.startswith("sample:"):
        hint_match = species_by_id.get(hint_id.removeprefix("sample:"))
    if hint_match is not None:
        return VisionResponse(
            en_pnnn=True,
            nombre_comun=hint_match.nombre_comun,
            nombre_cientifico=hint_match.nombre_cientifico,
            tipo=hint_match.tipo,
            estado=hint_match.estado,
            rol_ecologico=hint_match.rol_ecologico,
            alerta_conservacion=hint_match.alerta_conservacion,
            confianza="Catálogo Offline Verificado",
            descripcion_ia=f"Ficha científica cargada desde la base local de Kumanday: {hint_match.rol_ecologico}",
            model="offline-knowledge-base",
            fallback_used=True,
        )

    return VisionResponse(
        en_pnnn=False,
        nombre_comun="Motor visual IA no disponible",
        nombre_cientifico="Verificación visual en espera",
        tipo="Sin Confirmación",
        estado="Ollama multimodal offline",
        rol_ecologico=(
            "Para evitar identificaciones falsas sobre fotografías subidas, Kumanday no asigna "
            "especies al azar cuando el modelo visual local está apagado."
        ),
        alerta_conservacion=(
            "Activa Ollama con gemma3:4b para analizar fotos personalizadas o usa las muestras "
            "verificadas y el catálogo de 12 especies."
        ),
        confianza="Sin confirmación",
        descripcion_ia=(
            f"No se pudo conectar con {settings.ollama_vision_model}. La imagen pasó las validaciones "
            "de formato, pero requiere el motor local activo para clasificarse."
        ),
        model="offline-knowledge-base",
        fallback_used=True,
    )
