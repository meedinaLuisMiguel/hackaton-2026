"""Kumanday AI Agent orchestrator, strict image validation, and Ollama integration."""

import base64
import hashlib
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
BUNDLED_SAMPLE_SHA256 = {
    "chivito": "21b940967d4590f1114c0b8a2cb57a1d0ec0f4be5f8cced43686ec691a8f12a7",
    "condor": "c0e360beec5f7093adc09d8758a9c27d4a153c75d0210223d69845101e862b0a",
    "frailejon": "7211be72a88136f3493e547592e5f4e63bb56fdb70608ca50d35c83a7b52b163",
    "oso": "da2c0fa131a1b9289f0be6a397d0dfb7efd1daef68118285bb65637d5b5b5f4c",
}

SAFETY_KEYWORDS = (
    "dolor de cabeza",
    "soroche",
    "mareo",
    "mareos",
    "nausea",
    "vomito",
    "vomitos",
    "hipotermia",
    "temblor",
    "temblores",
    "frio extremo",
    "falta de aire",
    "mal de altura",
    "emergencia",
    "emergencias",
    "auxilio",
    "sos",
    "volcan",
    "volcanico",
    "volcanica",
    "volcanes",
    "erupcion",
    "erupciones",
    "ceniza",
    "cenizas",
    "azufre",
    "rescate",
    "evacuacion",
    "sintoma",
    "sintomas",
    "headache",
    "altitude sickness",
    "dizziness",
    "nausea",
    "vomiting",
    "hypothermia",
    "shivering",
    "extreme cold",
    "shortness of breath",
    "emergency",
    "emergencies",
    "sos",
    "volcano",
    "volcanic",
    "volcanoes",
    "eruption",
    "ash",
    "sulfur",
    "rescue",
    "evacuation",
    "symptom",
    "symptoms",
)

CURRENT_CONDITION_KEYWORDS = (
    "hoy",
    "actual",
    "actualmente",
    "ahora",
    "ahora mismo",
    "alerta",
    "actuales",
    "abierto",
    "abierta",
    "abiertos",
    "abiertas",
    "cerrado",
    "cerrada",
    "cerrados",
    "cerradas",
    "horario de ingreso",
    "horarios de ingreso",
    "acceso hoy",
    "se puede ingresar",
    "estado del volcan",
    "actividad volcanica actual",
    "clima actual",
    "clima de hoy",
    "pronostico",
    "today",
    "current",
    "currently",
    "right now",
    "open now",
    "open today",
    "is it open",
    "closed now",
    "current access",
    "alert",
    "volcano status",
    "weather today",
    "forecast",
)

MEDICAL_KEYWORDS = (
    "soroche",
    "hipotermia",
    "dolor de cabeza",
    "nausea",
    "vomito",
    "falta de aire",
    "mal de altura",
    "sintoma",
    "sintomas",
    "headache",
    "altitude sickness",
    "vomiting",
    "shortness of breath",
    "symptom",
    "symptoms",
)

GUIDE_QUERY_STOPWORDS = {
    "que", "como", "cual", "cuales", "donde", "cuando", "porque", "hay", "ser",
    "vivo", "vivos", "vida", "ningun", "ninguna", "ninguno", "ningunas", "ningunos",
    "especie", "especies", "flora", "fauna", "animal", "animales", "planta", "plantas",
    "naturaleza", "biodiversidad", "parque", "pnn", "pnnn", "los", "las", "del", "de",
    "una", "uno", "unos", "unas", "para", "por", "con", "sin", "esta", "este", "eso",
    "aqui", "alli", "existe", "existen", "viven", "vive", "tiene", "tienen",
    "the", "what", "which", "where", "when", "why", "are", "there", "any", "living",
    "being", "beings", "thing", "things", "species", "animals", "plants", "wildlife",
    "biodiversity", "park", "life", "forms",
}

SPECIES_QUERY_STOPWORDS = GUIDE_QUERY_STOPWORDS | {
    "paramo",
    "nevado",
    "nevados",
    "ecosistema",
    "ecosistemas",
    "natural",
    "nativo",
    "nativa",
}

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
    "ser vivo",
    "seres vivos",
    "biodiversidad",
    "vida silvestre",
    "naturaleza",
    "ecosistema",
    "ecologia",
    "liquen",
    "liquenes",
    "hongo",
    "hongos",
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
    "trail",
    "route",
    "altitude",
    "elevation",
    "weather",
    "cold",
    "fog",
    "water",
    "peatland",
    "frailejon",
    "species",
    "animal",
    "plant",
    "bird",
    "flora",
    "fauna",
    "living thing",
    "living things",
    "biodiversity",
    "wildlife",
    "nature",
    "ecosystem",
    "ecology",
    "lichen",
    "fungus",
    "fungi",
    "park",
    "guide",
    "ranger",
    "rule",
    "reservation",
    "schedule",
    "clothing",
    "hydration",
    "hello",
    "who are you",
    "thank you",
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


def _matches_keyword(text: str, keyword: str) -> bool:
    """Match normalized keywords as whole words to avoid accidental safety triggers."""
    return re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", text) is not None


def _matches_any_keyword(text: str, keywords: tuple[str, ...]) -> bool:
    return any(_matches_keyword(text, keyword) for keyword in keywords)


def _matches_word_or_plural(text: str, word: str) -> bool:
    normalized_word = _normalize_text(word)
    if " " in normalized_word:
        return _matches_keyword(text, normalized_word)
    return re.search(
        rf"(?<![a-z0-9]){re.escape(normalized_word)}(?:es|s)?(?![a-z0-9])",
        text,
    ) is not None


def _is_greeting_only(norm_query: str) -> bool:
    greetings = ("hola", "buenos dias", "buenas tardes", "buenas noches", "quien eres", "ayuda")
    tokens = norm_query.split()
    return len(tokens) <= 5 and any(g in norm_query for g in greetings)


def _is_in_domain(request: ChatRequest, kb: KnowledgeBase) -> bool:
    """Verify the prompt belongs to PNN Los Nevados ecology, trails, or mountain safety."""
    norm = _normalize_text(request.message)
    if _matches_any_keyword(norm, SAFETY_KEYWORDS) or any(kw in norm for kw in DOMAIN_KEYWORDS):
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
    species_query_tokens = q_tokens - SPECIES_QUERY_STOPWORDS
    safety_alert = _matches_any_keyword(norm_query, SAFETY_KEYWORDS)

    observations: list[str] = []
    sources: list[str] = []
    tools_used: list[str] = []
    suggested_action: Literal["none", "open_safety", "open_rutas", "open_vision"] = "none"

    # Tool 1: Radar de Altitud
    radar_terms = (
        "altitud",
        "altura",
        "metros",
        "msnm",
        "piso termico",
        "elevation",
        "altitude",
    )
    if request.altitud_m is not None and _matches_any_keyword(norm_query, radar_terms):
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
        haystack = f"{sp.id} {sp.nombre_comun} {sp.nombre_cientifico} {sp.tipo}"
        score = len(species_query_tokens & _tokenize(haystack))
        species_name_tokens = _tokenize(sp.nombre_comun) - SPECIES_QUERY_STOPWORDS
        if any(_matches_word_or_plural(norm_query, word) for word in species_name_tokens):
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

    if (
        not scored_species
        and not scored_routes
        and "consultar_radar_altitud" not in tools_used
        and not safety_alert
    ):
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


def _is_biodiversity_overview_request(norm_query: str, kb: KnowledgeBase) -> bool:
    overview_terms = (
        "ser vivo",
        "seres vivos",
        "especie",
        "especies",
        "flora",
        "fauna",
        "animal",
        "animales",
        "animals",
        "plantas",
        "plants",
        "biodiversidad",
        "vida silvestre",
        "living thing",
        "living things",
        "species",
        "wildlife",
        "biodiversity",
    )
    specific_species = any(
        _matches_word_or_plural(norm_query, _normalize_text(value))
        for sp in kb.especies
        for value in (sp.id, sp.nombre_comun, sp.nombre_cientifico)
    )
    return not specific_species and _matches_any_keyword(norm_query, overview_terms)


def _is_current_or_access_question(norm_query: str) -> bool:
    return _matches_any_keyword(norm_query, CURRENT_CONDITION_KEYWORDS)


def _is_medical_question(norm_query: str) -> bool:
    return _matches_any_keyword(norm_query, MEDICAL_KEYWORDS)


def _is_abundance_question(norm_query: str) -> bool:
    return _matches_any_keyword(
        norm_query,
        (
            "mas abundante",
            "mas comun",
            "mas frecuente",
            "predomina",
            "abundancia",
            "most abundant",
            "most common",
            "most frequent",
            "abundance",
        ),
    )


def _append_chat_notice(reply: str, language: str, *, local_catalog: bool) -> str:
    if local_catalog:
        notice = (
            "Nota: esta respuesta usa el catálogo local de la app, no una cita UTON. No es un inventario "
            "completo ni confirma un avistamiento en tu ubicación."
            if language == "es"
            else "Note: this answer uses the app's local catalog, not a UTON citation. It is not a complete "
            "inventory and does not confirm a sighting at your location."
        )
    else:
        notice = (
            "Nota: es una explicación general de IA local, no aparece en los guiones UTON y no está "
            "validada por UTON. No confirma presencia de especies ni condiciones actuales en el PNN; para "
            "información local, consulta a un guía autorizado."
            if language == "es"
            else "Note: this is general local AI information, not in the UTON guides and not validated by "
            "UTON. It does not confirm species presence or current PNN conditions; ask an authorized guide "
            "for local information."
        )
    return f"{reply.rstrip()}\n\n{notice}"


def _biodiversity_catalog_reply(kb: KnowledgeBase, language: str) -> str:
    examples = ", ".join(sp.nombre_comun for sp in kb.especies[:5])
    if language == "en":
        reply = (
            f"Yes. Kumanday's local catalog includes {len(kb.especies)} selected species, including "
            f"{examples}. It is not a complete inventory of the park and does not report abundance."
        )
    else:
        reply = (
            f"Sí. El catálogo local de Kumanday incluye {len(kb.especies)} especies destacadas, entre ellas "
            f"{examples}. No es un inventario completo del parque ni informa su abundancia."
        )
    return _append_chat_notice(reply, language, local_catalog=True)


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
        if _matches_word_or_plural(norm_query, sp.id):
            score += 4
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


async def _generate_unverified_chat_response(
    request: ChatRequest,
    kb: KnowledgeBase,
    settings: Settings,
    http_client: httpx.AsyncClient | None,
) -> ChatResponse:
    norm_query = _normalize_text(request.message)
    if _is_greeting_only(norm_query):
        reply = (
            "Hello, I'm Kumanday, your local guide to Los Nevados. I can help with park biodiversity, "
            "routes, and the UTON guide sources."
            if request.language == "en"
            else "Hola, soy Kumanday, tu guía local del PNN Los Nevados. Puedo ayudarte con biodiversidad, "
            "rutas y fuentes de los guiones UTON."
        )
        return ChatResponse(
            reply=reply,
            sources=[],
            tools_used=[],
            model="kumanday-router",
            fallback_used=True,
            insufficient_evidence=True,
        )

    if _is_biodiversity_overview_request(norm_query, kb):
        if _is_abundance_question(norm_query):
            reply = (
                "The local catalog has no abundance data to determine which species are most common."
                if request.language == "en"
                else "El catálogo local no contiene datos de abundancia para determinar qué especies son más comunes."
            )
            reply = _append_chat_notice(reply, request.language, local_catalog=True)
        else:
            reply = _biodiversity_catalog_reply(kb, request.language)
        return ChatResponse(
            reply=reply,
            sources=[
                "Local Los Nevados species catalog"
                if request.language == "en"
                else "Catálogo local de especies PNN Los Nevados"
            ],
            tools_used=["consultar_catalogo_especies"],
            model="pnnn-local-catalog",
            fallback_used=True,
            insufficient_evidence=True,
        )

    in_domain = _is_in_domain(request, kb)
    observations = ""
    sources: list[str] = []
    tools_used: list[str] = []
    suggested_action: Literal["none", "open_safety", "open_rutas", "open_vision"] = "none"
    if in_domain:
        observations, candidate_sources, candidate_tools, _, suggested_action = _execute_agent_tools(
            request, kb
        )
        radar_terms = (
            "altitud",
            "altura",
            "metros",
            "msnm",
            "piso termico",
            "elevation",
            "altitude",
        )
        radar_is_relevant = _matches_any_keyword(norm_query, radar_terms)
        tools_used = [
            tool
            for tool in candidate_tools
            if tool != "consultar_radar_altitud" or radar_is_relevant
        ]
        if "consultar_radar_altitud" in candidate_tools and not radar_is_relevant:
            observations = "\n".join(
                line
                for line in observations.splitlines()
                if not line.startswith("[HERRAMIENTA: consultar_radar_altitud")
            )
            candidate_sources = [source for source in candidate_sources if not source.startswith("Radar")]

        relevant_tool_used = any(
            tool in tools_used
            for tool in ("consultar_especie", "consultar_ruta", "consultar_radar_altitud")
        )
        if relevant_tool_used:
            sources = candidate_sources
        else:
            observations = ""

    if not in_domain:
        system_prompt = (
            "Eres Kumanday, un asistente local. Responde la pregunta general directamente, con prudencia y "
            f"en {'inglés' if request.language == 'en' else 'español'}; si no sabes, dilo. No inventes citas "
            "ni fuerces una conexión con el parque. Termina con una frase breve que recuerde que tu "
            "especialidad es el PNN Los Nevados."
        )
        sources = [
            "General response · local AI"
            if request.language == "en"
            else "Respuesta general · IA local"
        ]
    else:
        system_prompt = (
            "Eres Kumanday, intérprete del PNN Los Nevados. Responde en "
            f"{'inglés' if request.language == 'en' else 'español'}, de forma directa y breve. La búsqueda "
            "no encontró un fragmento UTON pertinente. Puedes explicar conceptos generales de ecología, "
            "pero no los atribuyas a UTON. Usa los datos locales solo para afirmaciones específicas del "
            "parque; no deduzcas presencia, abundancia, ubicación, estado de conservación ni avistamientos "
            "a partir de conocimiento general. No inventes citas, cifras ni especies. Si el tema depende "
            "de datos locales que no aparecen abajo, dilo y remite a un guía autorizado. El historial es "
            "contexto de diálogo, no evidencia verificada.\n\n"
            f"DATOS LOCALES PERTINENTES:\n{observations or 'Ninguno para esta pregunta.'}"
        )
        if not sources:
            sources = [
                "General local AI response · not validated by UTON"
                if request.language == "en"
                else "Respuesta general de IA local · no validada por UTON"
            ]

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(
        {"role": turn.role, "content": turn.content} for turn in request.history[-2:]
    )
    messages.append({"role": "user", "content": request.message})
    try:
        data = await _post_to_ollama(
            f"{settings.ollama_base_url.rstrip('/')}/api/chat",
            {
                "model": settings.ollama_model,
                "messages": messages,
                "stream": False,
                "keep_alive": "15m",
                "options": {
                    "temperature": 0.2,
                    "num_ctx": 2048,
                    "num_predict": 180,
                },
            },
            settings.ollama_timeout_seconds,
            http_client=http_client,
        )
        message_obj = data.get("message")
        reply = str(message_obj.get("content", "")).strip() if isinstance(message_obj, dict) else ""
        if reply:
            reply = _constrain_chat_reply(reply)
            if in_domain:
                local_catalog = bool(
                    sources
                    and sources[0]
                    not in (
                        "Respuesta general de IA local · no validada por UTON",
                        "General local AI response · not validated by UTON",
                    )
                )
                reply = _append_chat_notice(
                    reply, request.language, local_catalog=local_catalog
                )
            elif "especialidad" not in _normalize_text(reply) and "specialty" not in _normalize_text(reply):
                reply += (
                    "\n\nMy specialty is the PNN Los Nevados."
                    if request.language == "en"
                    else "\n\nMi especialidad es el PNN Los Nevados."
                )
            return ChatResponse(
                reply=reply,
                sources=sources,
                tools_used=tools_used + ["consulta_general"],
                suggested_action=suggested_action,
                out_of_domain=not in_domain,
                model=settings.ollama_model,
                fallback_used=False,
                insufficient_evidence=in_domain,
            )
    except (httpx.HTTPError, ValueError):
        pass

    if in_domain and any(tool in tools_used for tool in ("consultar_especie", "consultar_ruta")):
        if request.language == "en":
            offline_reply = (
                "The local catalog has relevant information, but its verified description is available only "
                "in Spanish while the AI model is offline. Please consult an authorized guide."
            )
        else:
            offline_reply = _build_offline_agent_reply(request, kb, safety_alert=False)
        return ChatResponse(
            reply=_append_chat_notice(offline_reply, request.language, local_catalog=True),
            sources=sources,
            tools_used=tools_used,
            suggested_action=suggested_action,
            out_of_domain=False,
            model="offline-knowledge-base",
            fallback_used=True,
            insufficient_evidence=True,
        )

    if not in_domain:
        offline_reply = (
            "I can't answer that right now because the local model is unavailable. My specialty is the "
            "PNN Los Nevados: biodiversity, routes, and mountain interpretation."
            if request.language == "en"
            else "No pude responder porque el modelo local no está disponible. Mi especialidad es el PNN "
            "Los Nevados: biodiversidad, rutas e interpretación de montaña."
        )
    else:
        offline_reply = (
            "I don't have enough local information to answer this confidently. Please ask an authorized guide."
            if request.language == "en"
            else "No tengo información local suficiente para responder con precisión. Consulta a un guía autorizado."
        )
        sources = []
    return ChatResponse(
        reply=offline_reply,
        sources=sources,
        tools_used=tools_used + ["consulta_general"],
        suggested_action=suggested_action,
        out_of_domain=not in_domain,
        model="kumanday-router",
        fallback_used=True,
        insufficient_evidence=in_domain,
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
    """Prefer cited UTON evidence, then label local-catalog or general answers explicitly."""
    kb = load_knowledge()
    norm_query = _normalize_text(request.message)
    is_safety = _matches_any_keyword(norm_query, SAFETY_KEYWORDS)
    is_current = _is_current_or_access_question(norm_query)
    is_medical = _is_medical_question(norm_query)

    if is_safety or is_current or is_medical:
        reply = (
            "I can't assess medical, volcanic, access, or current conditions. Please contact an "
            "authorized expert guide on site."
            if request.language == "en"
            else "No puedo evaluar situaciones médicas, volcánicas, de acceso ni condiciones actuales. "
            "Comunícate con un guía experto autorizado en el lugar."
        )
        return ChatResponse(
            reply=reply,
            sources=[],
            tools_used=["derivar_a_guia_autorizado"],
            suggested_action="open_safety",
            out_of_domain=False,
            model="safety-router",
            fallback_used=True,
            safety_alert=is_safety or is_medical,
            insufficient_evidence=True,
        )

    query_tokens = _tokenize(request.message) - GUIDE_QUERY_STOPWORDS
    ranked_chunks: list[tuple[int, dict[str, object]]] = []
    station_hint = next(
        (
            station
            for station in (
                "brisas",
                "aguacerales",
                "arenales",
                "lunares",
                "valle lunar",
                "valle de las tumbas",
            )
            if station in norm_query
        ),
        None,
    )
    for chunk in request.guide_chunks:
        if not chunk.get("source") or not chunk.get("page"):
            continue
        candidate_text = str(chunk.get("text", ""))
        candidate_tokens = _tokenize(candidate_text)
        score = len(query_tokens & candidate_tokens)
        if station_hint and station_hint in _normalize_text(candidate_text):
            score += 5
        if score:
            ranked_chunks.append((score, chunk))
    ranked_chunks.sort(key=lambda item: item[0], reverse=True)
    evidence = [chunk for _, chunk in ranked_chunks[:4]]
    source_labels = [str(chunk.get("citation") or f"{chunk.get('source')} · p. {chunk.get('page')}") for chunk in evidence]
    if not evidence:
        return await _generate_unverified_chat_response(request, kb, settings, http_client)

    if request.language == "en":
        return ChatResponse(
            reply="The available UTON guide excerpts are in Spanish. To avoid changing their meaning, I can only provide a verified answer in Spanish. Please ask in Spanish or consult an authorized expert guide.",
            sources=source_labels,
            tools_used=["consulta_fuentes_uton"],
            model="uton-language-guardrail",
            fallback_used=True,
            insufficient_evidence=True,
        )

    context = "\n".join(
        f"[FUENTE: {chunk.get('source')} | página {chunk.get('page')}] {chunk.get('text')}"
        for chunk in evidence
    )
    system_prompt = (
        "Eres Kumanday, intérprete del recorrido norte del PNN Los Nevados. Responde en español claro y breve, "
        "usando exclusivamente las evidencias citadas. No agregues conocimiento externo. Si no alcanza, "
        "di que no conoces la respuesta y pide comunicarse con un guía experto autorizado. Distingue los relatos "
        "culturales como tradición oral. Termina con las fuentes y páginas exactas.\n\n"
        f"EVIDENCIA:\n{context}"
    )
    try:
        data = await _post_to_ollama(
            f"{settings.ollama_base_url.rstrip('/')}/api/chat",
            {"model": settings.ollama_model, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": request.message}], "stream": False, "keep_alive": "15m", "options": {"temperature": 0.1, "num_ctx": 2048, "num_predict": 180}},
            settings.ollama_timeout_seconds,
            http_client=http_client,
        )
        message_obj = data.get("message")
        reply = str(message_obj.get("content", "")).strip() if isinstance(message_obj, dict) else ""
        if reply:
            return ChatResponse(reply=_constrain_chat_reply(reply), sources=source_labels, tools_used=["recuperar_fragmentos_uton"], model=settings.ollama_model)
    except (httpx.HTTPError, ValueError):
        pass
    excerpts = " ".join(str(chunk.get("text", "")) for chunk in evidence)
    return ChatResponse(
        reply=f"{excerpts[:520]}\n\nFuentes: " + "; ".join(source_labels),
        sources=source_labels,
        tools_used=["recuperar_fragmentos_uton"],
        model="uton-grounded-extract",
        fallback_used=True,
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


def _normalize_confidence(value: object) -> str:
    if isinstance(value, bool):
        return "Baja"
    if isinstance(value, (int, float)):
        if not 0 <= value <= 1:
            return "Baja"
        return "Alta" if value >= 0.75 else "Media" if value >= 0.5 else "Baja"

    text = _normalize_text(str(value or "Media")).strip()
    if text in {"alta", "high"}:
        return "Alta"
    if text in {"media", "medium", "moderate"}:
        return "Media"
    if text in {"baja", "low"}:
        return "Baja"
    try:
        return _normalize_confidence(float(text))
    except ValueError:
        return "Baja"


def _match_catalog_species(
    species_by_id: dict[str, Especie],
    species_id: str,
    detected_object: str,
) -> Especie | None:
    normalized_id = _normalize_text(species_id)
    normalized_object = _normalize_text(detected_object)
    for species in species_by_id.values():
        aliases = (species.id, species.nombre_comun, species.nombre_cientifico)
        if any(
            _matches_word_or_plural(normalized_id, _normalize_text(alias))
            or _matches_word_or_plural(normalized_object, _normalize_text(alias))
            for alias in aliases
        ):
            return species
    return None


def _verified_sample_response(species: Especie, language: str) -> VisionResponse:
    return VisionResponse(
        en_pnnn=True,
        nombre_comun=species.nombre_comun,
        nombre_cientifico=species.nombre_cientifico,
        tipo=species.tipo,
        estado=species.estado,
        rol_ecologico=species.rol_ecologico,
        alerta_conservacion=species.alerta_conservacion,
        confianza=(
            "Verified offline catalog" if language == "en" else "Catálogo Offline Verificado"
        ),
        descripcion_ia=(
            f"Verified local species record loaded for {species.nombre_comun}."
            if language == "en"
            else f"Ficha científica cargada desde la base local de Kumanday: {species.rol_ecologico}"
        ),
        model="offline-knowledge-base",
        fallback_used=True,
    )


def _verified_bundled_sample(
    request: VisionRequest,
    species_by_id: dict[str, Especie],
) -> Especie | None:
    hint = _normalize_text(request.hint or "").strip()
    if not hint.startswith("sample:"):
        return None
    species_id = hint.removeprefix("sample:")
    species = species_by_id.get(species_id)
    expected_hash = BUNDLED_SAMPLE_SHA256.get(species_id)
    if species is None or expected_hash is None:
        return None

    encoded_image = request.image_base64.partition(",")[2] if request.image_base64.startswith("data:") else request.image_base64
    image_bytes = base64.b64decode(encoded_image, validate=True)
    if hashlib.sha256(image_bytes).hexdigest() != expected_hash:
        return None
    return species


async def analyze_species_image(
    request: VisionRequest,
    settings: Settings,
    http_client: httpx.AsyncClient | None = None,
) -> VisionResponse:
    """Identify image objectively via Ollama vision, rejecting non-PNNN species like tigers."""
    clean_b64 = normalize_image_base64(request.image_base64)
    kb = load_knowledge()
    species_by_id = {sp.id: sp for sp in kb.especies}
    sample_species = _verified_bundled_sample(request, species_by_id)

    catalog_ids = ", ".join(
        f"{sp.id} ({sp.nombre_comun}; {sp.nombre_cientifico})" for sp in kb.especies
    )
    alt_context = (
        f"Contexto de altitud del dispositivo: {request.altitud_m} m s.n.m. "
        if request.altitud_m is not None
        else ""
    )

    language_instruction = (
        "Write all user-facing text values in English. Keep the category values exactly in Spanish as listed."
        if request.language == "en"
        else "Escribe los valores de texto para la persona usuaria en español."
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
        "4. Atención especial al Frailejón del Ruiz (id frailejon, Espeletia hartwegiana): busca la "
        "combinación visible de una roseta grande de hojas largas, densamente vellosas y plateadas/gris, "
        "con tallos florales erguidos y capítulos amarillos. Si esa combinación es clara, clasifícalo como "
        "frailejon; flores amarillas o un paisaje de páramo por sí solos no bastan. No descartes una especie "
        "del catálogo como planta genérica cuando sus rasgos diagnósticos sí sean visibles.\n"
        f"{language_instruction}\n"
        "Responde EXCLUSIVAMENTE en JSON válido con esta estructura exacta:\n"
        '{"objeto_detectado": "nombre real en el idioma solicitado", '
        '"es_especie_pnnn": true o false, '
        '"especie_id": "id exacto de la lista o ninguna", '
        '"categoria": "Flora|Fauna|Paisaje|No pertenece al PNNN", '
        '"confianza": "Alta|Media|Baja", '
        '"observacion": "Máximo 2 oraciones claras describiendo lo observado en el idioma solicitado."}'
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
                    "temperature": 0.0,
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
            confianza = _normalize_confidence(parsed.get("confianza"))
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

            matched = _match_catalog_species(species_by_id, especie_id, objeto) if is_pnnn else None
            if matched is not None and (
                category != _normalize_text(matched.tipo) or confianza == "Baja"
            ):
                matched = None
            if sample_species is not None and (
                not is_pnnn or matched is None or matched.id != sample_species.id
            ):
                return _verified_sample_response(sample_species, request.language)

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

    if sample_species is not None:
        return _verified_sample_response(sample_species, request.language)

    return VisionResponse(
        en_pnnn=False,
        nombre_comun=(
            "AI vision model unavailable"
            if request.language == "en"
            else "Motor visual IA no disponible"
        ),
        nombre_cientifico=(
            "Visual verification pending"
            if request.language == "en"
            else "Verificación visual en espera"
        ),
        tipo="Sin Confirmación",
        estado="Ollama multimodal offline",
        rol_ecologico=(
            "To avoid false identifications of uploaded photos, Kumanday will not assign a species "
            "while the local vision model is off."
            if request.language == "en"
            else "Para evitar identificaciones falsas sobre fotografías subidas, Kumanday no asigna "
            "especies al azar cuando el modelo visual local está apagado."
        ),
        alerta_conservacion=(
            "Start Ollama with gemma3:4b to analyze personal photos, or use the verified samples and 12-species catalog."
            if request.language == "en"
            else "Activa Ollama con gemma3:4b para analizar fotos personalizadas o usa las muestras "
            "verificadas y el catálogo de 12 especies."
        ),
        confianza="Unconfirmed" if request.language == "en" else "Sin confirmación",
        descripcion_ia=(
            f"Could not connect to {settings.ollama_vision_model}. The image passed format validation, "
            "but the local vision model is required for analysis."
            if request.language == "en"
            else f"No se pudo conectar con {settings.ollama_vision_model}. La imagen pasó las validaciones "
            "de formato, pero requiere el motor local activo para clasificarse."
        ),
        model="offline-knowledge-base",
        fallback_used=True,
    )
