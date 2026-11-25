"""Local RAG retrieval and Ollama multimodal integration with deterministic offline fallbacks."""

import base64
import io
import json
import re
import unicodedata

import httpx
from PIL import Image, UnidentifiedImageError

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

SAFETY_KEYWORDS = (
    "dolor de cabeza",
    "soroche",
    "mareo",
    "nausea",
    "vomito",
    "hipotermia",
    "temblor",
    "frio",
    "falta de aire",
    "emergencia",
    "auxilio",
    "sos",
    "volcan",
    "ceniza",
    "azufre",
)


def _normalize_text(text: str) -> str:
    """Lowercase and strip Spanish accents for robust offline keyword matching."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


def _tokenize(text: str) -> set[str]:
    return {tok for tok in re.findall(r"[a-z0-9]{3,}", _normalize_text(text))}


def _retrieve_context(
    query: str,
    kb: KnowledgeBase,
    altitud_m: int | None,
    ruta_id: str | None,
) -> tuple[str, list[str], bool]:
    """Select the highest-signal verified knowledge snippets for the prompt."""
    norm_query = _normalize_text(query)
    q_tokens = _tokenize(query)
    safety_alert = any(kw in norm_query for kw in SAFETY_KEYWORDS)

    blocks: list[str] = []
    sources: list[str] = []

    if altitud_m is not None:
        radar = calculate_radar(altitud_m)
        blocks.append(
            f"[CONTEXTO GPS ACTUAL] Altitud: {altitud_m} m s.n.m. | "
            f"Piso térmico: {radar.piso_termico.piso} ({radar.piso_termico.temp}). "
            f"Riesgo de soroche: {radar.riesgo_soroche}. {radar.recomendacion_seguridad}"
        )
        sources.append(f"Radar Altitud ({radar.piso_termico.piso})")

    if safety_alert:
        for key, proto in kb.protocolos_vida.items():
            blocks.append(
                f"[PROTOCOLO DE VIDA: {proto.titulo}] "
                f"Síntomas: {', '.join(proto.sintomas)}. "
                f"Acción inmediata: {proto.accion_inmediata}"
            )
            sources.append(f"Protocolo {key.capitalize()}")

    scored_items: list[tuple[int, str, str]] = []

    for sp in kb.especies:
        haystack = f"{sp.nombre_comun} {sp.nombre_cientifico} {sp.tipo} {sp.rol_ecologico} {sp.alerta_conservacion}"
        score = len(q_tokens & _tokenize(haystack))
        if any(word in norm_query for word in _tokenize(sp.nombre_comun)):
            score += 3
        if ("ave" in norm_query or "pajaro" in norm_query or "colibri" in norm_query) and sp.id in (
            "chivito",
            "condor",
        ):
            score += 2
        if "agua" in norm_query and sp.id == "frailejon":
            score += 3
        if score > 0:
            snippet = (
                f"[ESPECIE: {sp.nombre_comun} ({sp.nombre_cientifico})] "
                f"Tipo: {sp.tipo} | Estado: {sp.estado}. "
                f"Rol ecológico: {sp.rol_ecologico} "
                f"Conservación: {sp.alerta_conservacion}"
            )
            scored_items.append((score, snippet, sp.nombre_comun))

    for ruta in kb.rutas:
        haystack = f"{ruta.nombre} {ruta.sector} {' '.join(ruta.estaciones)} {ruta.reglas}"
        score = len(q_tokens & _tokenize(haystack))
        if ruta_id and ruta.id == ruta_id:
            score += 5
        if score > 0:
            snippet = (
                f"[RUTA: {ruta.nombre}] Sector: {ruta.sector}, Altitud: {ruta.altitud_rango}, "
                f"Distancia: {ruta.distancia_km} km, Dificultad: {ruta.dificultad}. "
                f"Estaciones: {'; '.join(ruta.estaciones)}. Reglas: {ruta.reglas}"
            )
            scored_items.append((score, snippet, ruta.nombre))

    for belt in kb.pisos_termicos:
        haystack = f"{belt.piso} {belt.descripcion} {' '.join(belt.especies_clave)}"
        score = len(q_tokens & _tokenize(haystack))
        if score > 0:
            snippet = (
                f"[PISO TÉRMICO: {belt.piso}] {belt.min_m}-{belt.max_m} m s.n.m. ({belt.temp}). "
                f"{belt.descripcion} Especies clave: {', '.join(belt.especies_clave)}."
            )
            scored_items.append((score, snippet, belt.piso))

    scored_items.sort(key=lambda item: item[0], reverse=True)
    for _, snippet, label in scored_items[:4]:
        blocks.append(snippet)
        if label not in sources:
            sources.append(label)

    if not scored_items:
        # Provide baseline verified summary so the model remains grounded
        blocks.append(
            "[RESUMEN PNNN] Especies principales: Frailejón del Ruiz (Espeletia hartwegiana), "
            "Chivito de Páramo (Oxypogon stubelii), Cóndor de los Andes (Vultur gryphus) y Oso de Anteojos (Tremarctos ornatus). "
            "Rutas autorizadas: Brisas–Valle de las Tumbas, Cisne–Laguna Verde y Potosí–Laguna del Otún."
        )
        sources.append("Base Científica PNN Los Nevados")

    return "\n".join(blocks), sources, safety_alert


def _build_offline_chat_reply(
    query: str,
    kb: KnowledgeBase,
    altitud_m: int | None,
    safety_alert: bool,
) -> str:
    """Build a deterministic, concise <=3 paragraph reply from verified JSON when Ollama is offline."""
    norm_query = _normalize_text(query)
    paragraphs: list[str] = []

    if safety_alert:
        if any(w in norm_query for w in ("hipotermia", "temblor", "frio")):
            proto = kb.protocolos_vida["hipotermia"]
        elif any(w in norm_query for w in ("volcan", "ceniza", "azufre")):
            proto = kb.protocolos_vida["volcanico"]
        else:
            proto = kb.protocolos_vida["soroche"]

        alt_note = f" a {altitud_m} m s.n.m." if altitud_m is not None else ""
        paragraphs.append(
            f"Alerta prioritaria de seguridad{alt_note} — {proto.titulo}: "
            f"{proto.accion_inmediata}"
        )

    q_tokens = _tokenize(query)
    best_species: Especie | None = None
    best_score = 0
    for sp in kb.especies:
        score = len(q_tokens & _tokenize(f"{sp.nombre_comun} {sp.nombre_cientifico} {sp.rol_ecologico}"))
        if "agua" in norm_query and sp.id == "frailejon":
            score += 3
        if ("ave" in norm_query or "colibri" in norm_query) and sp.id == "chivito":
            score += 2
        if score > best_score:
            best_score = score
            best_species = sp

    if best_species is not None:
        paragraphs.append(
            f"{best_species.nombre_comun} ({best_species.nombre_cientifico}) — {best_species.estado}. "
            f"{best_species.rol_ecologico}"
        )
        paragraphs.append(f"Alerta de conservación: {best_species.alerta_conservacion}")
    elif "ave" in norm_query or "fauna" in norm_query:
        paragraphs.append(
            "En el PNN Los Nevados habitan aves emblemáticas como el Chivito de Páramo (Oxypogon stubelii), "
            "un colibrí endémico que anida usando lana de frailejón, y el Cóndor de los Andes (Vultur gryphus) en vuelos altos."
        )
    elif not paragraphs:
        if altitud_m is not None:
            radar = calculate_radar(altitud_m)
            paragraphs.append(
                f"A {altitud_m} m s.n.m. te encuentras en {radar.piso_termico.piso} ({radar.piso_termico.temp}): "
                f"{radar.piso_termico.descripcion}"
            )
            paragraphs.append(
                f"Especies clave esperadas: {', '.join(radar.piso_termico.especies_clave)}. "
                f"Recomendación: {radar.recomendacion_seguridad}"
            )
        else:
            paragraphs.append(
                "El Parque Nacional Natural Los Nevados protege ecosistemas desde el Bosque Altoandino (2.300 m) hasta el Superpáramo (4.800 m), "
                "regulados hídricamente por el Frailejón del Ruiz (Espeletia hartwegiana)."
            )
            paragraphs.append(
                "Recuerda transitar siempre con guía avalado, respetar las reglas de ingreso (8:00 a.m. a 2:00 p.m. en Brisas) "
                "y no salir de los senderos demarcados."
            )

    return "\n\n".join(paragraphs[:3])


async def _post_to_ollama(
    url: str,
    payload: dict[str, object],
    timeout: float,
) -> dict[str, object]:
    """Send an async JSON POST request to the local Ollama HTTP API."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {}


async def list_ollama_models(settings: Settings) -> tuple[bool, list[str]]:
    """Query Ollama /api/tags to check connectivity and installed models."""
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            payload = resp.json()
            models = [m.get("name", "") for m in payload.get("models", []) if m.get("name")]
            return True, models
    except (httpx.HTTPError, ValueError):
        return False, []


async def generate_chat_response(request: ChatRequest, settings: Settings) -> ChatResponse:
    """Answer hiker questions using verified local knowledge + Ollama, with deterministic fallback."""
    kb = load_knowledge()
    context, sources, safety_alert = _retrieve_context(
        query=request.message,
        kb=kb,
        altitud_m=request.altitud_m,
        ruta_id=request.ruta_id,
    )

    system_prompt = (
        "Eres el Guía Científico y Guardaparques IA del Parque Nacional Natural Los Nevados (Colombia). "
        "Responde ÚNICAMENTE con base en la información verificada proporcionada abajo, en español claro y amable, "
        "en MÁXIMO 3 párrafos cortos y concisos. Prioriza la seguridad humana (soroche, hipotermia, riesgo volcánico) "
        "y la conservación del páramo. Si algo no está en la base verificada, indícalo con honestidad sin inventar datos.\n\n"
        f"BASE VERIFICADA PNN LOS NEVADOS:\n{context}"
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
                "options": {"temperature": 0.2, "num_predict": 320},
            },
            settings.ollama_timeout_seconds,
        )
        message_obj = data.get("message")
        reply = (
            str(message_obj.get("content", "")).strip()
            if isinstance(message_obj, dict)
            else ""
        )
        if reply:
            return ChatResponse(
                reply=reply,
                sources=sources,
                model=settings.ollama_model,
                fallback_used=False,
                safety_alert=safety_alert,
            )
    except (httpx.HTTPError, ValueError):
        pass

    fallback_reply = _build_offline_chat_reply(
        query=request.message,
        kb=kb,
        altitud_m=request.altitud_m,
        safety_alert=safety_alert,
    )
    return ChatResponse(
        reply=fallback_reply,
        sources=sources,
        model="offline-knowledge-base",
        fallback_used=True,
        safety_alert=safety_alert,
    )


def normalize_image_base64(raw_b64: str) -> str:
    """Validate and resize an input base64 image so local vision models process it quickly."""
    cleaned = raw_b64.strip()
    if cleaned.startswith("data:") and "," in cleaned:
        cleaned = cleaned.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(cleaned, validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError("La imagen base64 no es válida.") from exc

    if not image_bytes:
        raise ValueError("La imagen está vacía.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            rgb = img.convert("RGB")
            rgb.thumbnail((768, 768))
            out = io.BytesIO()
            rgb.save(out, format="JPEG", quality=85)
            return base64.b64encode(out.getvalue()).decode("ascii")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("El archivo enviado no corresponde a una imagen válida.") from exc


def _extract_json_block(text: str) -> dict[str, str] | None:
    """Parse JSON object from an LLM response even if wrapped in markdown fences."""
    fenced = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not fenced:
        return None
    try:
        parsed = json.loads(fenced.group(0))
        if isinstance(parsed, dict):
            return {str(k): str(v) for k, v in parsed.items() if v is not None}
    except ValueError:
        return None
    return None


def _match_species_by_text(text: str | None, kb: KnowledgeBase) -> Especie | None:
    """Match a verified species by hint or model output text."""
    if not text:
        return None
    norm = _normalize_text(text)
    for sp in kb.especies:
        if (
            sp.id in norm
            or _normalize_text(sp.nombre_comun) in norm
            or _normalize_text(sp.nombre_cientifico) in norm
            or ("frailejon" in norm and sp.id == "frailejon")
            or (("chivito" in norm or "colibri" in norm or "barbudito" in norm) and sp.id == "chivito")
            or ("condor" in norm and sp.id == "condor")
            or ("oso" in norm and sp.id == "oso")
        ):
            return sp
    return None


async def analyze_species_image(request: VisionRequest, settings: Settings) -> VisionResponse:
    """Analyze a base64 photo using Ollama multimodal vision with verified species grounding."""
    clean_b64 = normalize_image_base64(request.image_base64)
    kb = load_knowledge()

    species_catalog = "\n".join(
        f"- {sp.nombre_comun} ({sp.nombre_cientifico}): {sp.tipo}, {sp.estado}. {sp.rol_ecologico}"
        for sp in kb.especies
    )
    alt_context = (
        f"La fotografía fue tomada cerca de {request.altitud_m} m s.n.m. "
        if request.altitud_m is not None
        else ""
    )

    prompt = (
        "Eres un biólogo especialista del Parque Nacional Natural Los Nevados (Colombia). "
        f"{alt_context}Analiza esta imagen y determina si corresponde a una de estas especies prioritarias "
        "o al entorno de páramo:\n"
        f"{species_catalog}\n\n"
        "Responde EXCLUSIVAMENTE en formato JSON válido con estas llaves:\n"
        '{"especie_id": "frailejon|chivito|condor|oso|otro", '
        '"nombre_comun": "...", "nombre_cientifico": "...", '
        '"tipo": "Flora|Fauna|Entorno", "confianza": "Alta|Media|Baja", '
        '"descripcion": "Máximo 2 frases explicando rasgos visibles y valor ecológico."}'
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
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 240},
            },
            settings.ollama_timeout_seconds,
        )
        message_obj = data.get("message")
        raw_reply = (
            str(message_obj.get("content", "")).strip()
            if isinstance(message_obj, dict)
            else ""
        )
        parsed = _extract_json_block(raw_reply)

        matched = _match_species_by_text(
            (parsed.get("especie_id", "") + " " + parsed.get("nombre_comun", ""))
            if parsed
            else raw_reply,
            kb,
        )

        if matched is not None:
            desc = (parsed.get("descripcion") if parsed else None) or matched.rol_ecologico
            conf = (parsed.get("confianza") if parsed else None) or "Alta"
            return VisionResponse(
                nombre_comun=matched.nombre_comun,
                nombre_cientifico=matched.nombre_cientifico,
                tipo=matched.tipo,
                estado=matched.estado,
                rol_ecologico=matched.rol_ecologico,
                alerta_conservacion=matched.alerta_conservacion,
                confianza=conf,
                descripcion_ia=desc,
                model=settings.ollama_vision_model,
                fallback_used=False,
            )

        if parsed:
            tipo_val = parsed.get("tipo", "Entorno")
            safe_tipo = tipo_val if tipo_val in ("Flora", "Fauna", "Entorno") else "Entorno"
            return VisionResponse(
                nombre_comun=parsed.get("nombre_comun", "Elemento de Alta Montaña"),
                nombre_cientifico=parsed.get("nombre_cientifico", "Ecosistema PNN Los Nevados"),
                tipo=safe_tipo,  # type: ignore[arg-type]
                estado="Observación en campo",
                rol_ecologico="Parte de la dinámica hídrica y ecológica del complejo volcánico Ruiz–Tolima.",
                alerta_conservacion="Permanece en el sendero demarcado, no recolectes material vegetal ni dejes residuos.",
                confianza=parsed.get("confianza", "Media"),
                descripcion_ia=parsed.get("descripcion", raw_reply[:240]),
                model=settings.ollama_vision_model,
                fallback_used=False,
            )
    except (httpx.HTTPError, ValueError):
        pass

    # Deterministic offline fallback when Ollama vision is unavailable
    hint_match = _match_species_by_text(request.hint, kb)
    if hint_match is not None:
        return VisionResponse(
            nombre_comun=hint_match.nombre_comun,
            nombre_cientifico=hint_match.nombre_cientifico,
            tipo=hint_match.tipo,
            estado=hint_match.estado,
            rol_ecologico=hint_match.rol_ecologico,
            alerta_conservacion=hint_match.alerta_conservacion,
            confianza="Catálogo Offline Verificado",
            descripcion_ia=(
                f"Ficha científica cargada desde la base local del PNN Los Nevados: "
                f"{hint_match.rol_ecologico}"
            ),
            model="offline-knowledge-base",
            fallback_used=True,
        )

    radar = calculate_radar(request.altitud_m if request.altitud_m is not None else 4000)
    top_sp = radar.especies_probables[0]
    return VisionResponse(
        nombre_comun=f"Guía Offline ({top_sp.nombre_comun} probable)",
        nombre_cientifico=top_sp.nombre_cientifico,
        tipo=top_sp.tipo,
        estado="Motor visual local en espera • Respaldo offline",
        rol_ecologico=top_sp.rol_ecologico,
        alerta_conservacion=top_sp.alerta_conservacion,
        confianza="Respaldo por altitud",
        descripcion_ia=(
            f"El modelo de visión local ({settings.ollama_vision_model}) no está activo en este momento. "
            f"A {radar.altitud_m} m s.n.m. ({radar.piso_termico.piso}) es frecuente observar {top_sp.nombre_comun}."
        ),
        model="offline-knowledge-base",
        fallback_used=True,
    )
