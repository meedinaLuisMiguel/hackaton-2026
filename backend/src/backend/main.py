"""FastAPI entry point for Kumanday — Agente IA del PNN Los Nevados."""

import asyncio
import csv
import io
import re
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Literal

import httpx
import pymupdf
from fastapi import FastAPI, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.knowledge import calculate_radar, load_knowledge
from backend.rag_engine import (
    analyze_species_image,
    generate_chat_response,
    list_ollama_models,
)
from backend.schemas import (
    ChatRequest,
    ChatResponse,
    EmergenciaContacto,
    Especie,
    Estacion,
    HealthResponse,
    ProtocoloVida,
    RadarResponse,
    Ruta,
    VisionRequest,
    VisionResponse,
)
from backend.speech import transcribe_wav

settings = get_settings()
MAX_GUIDE_BYTES = 8 * 1024 * 1024
MAX_VOICE_BYTES = 1_000_000
SUPPORTED_GUIDE_SUFFIXES = {".pdf", ".txt", ".csv", ".docx"}

UTON_STATIONS = [
    Estacion(id="brisas", nombre="Brisas", altitud="Punto de entrada", tema="La puerta del páramo", resumen="Brisas introduce el recorrido norte y su importancia hídrica. Las fuentes entregadas no indican una altitud de estación para Brisas.", experiencia="Inicia observando el paisaje y conectando el recorrido con el agua que nace en la alta montaña.", fuentes=["Guion turístico zona norte, p. 5"]),
    Estacion(id="aguacerales", nombre="Aguacerales", altitud="4.160 m s. n. m.", tema="Agua que captura el páramo", resumen="La vegetación, los musgos y el suelo participan en la captación y regulación del agua.", experiencia="Observa la niebla, los frailejones y los hilos de agua. Sigue el sendero para proteger la vegetación.", fuentes=["Guion Ecoturístico UTON 2024, pp. 5–6", "Guion turístico zona norte, p. 5"]),
    Estacion(id="arenales", nombre="Arenales", altitud="4.290 m s. n. m.", tema="Dunas, viento y memoria", resumen="El viento modela depósitos de arena en un paisaje con memoria de la historia del esquí.", experiencia="Contempla las dunas desde el sendero y evita pisarlas: las huellas pueden permanecer por meses.", fuentes=["Guion Ecoturístico UTON 2024, p. 7", "Guion turístico zona norte, pp. 5–6"]),
    Estacion(id="lunares", nombre="Lunares / Valle Lunar", altitud="4.350 m s. n. m.", tema="La roca registra el cambio", resumen="La gelifracción fractura la roca cuando el agua en sus grietas se congela; la oxidación puede producir tonos rojizos.", experiencia="Busca fracturas y cambios de color sin mover ni llevarte rocas.", fuentes=["Guion Ecoturístico UTON 2024, pp. 8–9", "Guion turístico zona norte, p. 6"]),
    Estacion(id="valle-tumbas", nombre="Valle de las Tumbas", altitud="4.460 m s. n. m.", tema="Memoria cultural y cuidado", resumen="El paisaje guarda relatos y nombres transmitidos por tradición oral. El ascenso más allá del límite autorizado está restringido.", experiencia="Escucha los relatos con respeto. Para confirmar acceso, clima o condiciones volcánicas, consulta al guía autorizado.", fuentes=["Guion Ecoturístico UTON 2024, pp. 9–10", "Guion turístico zona norte, pp. 6–7"]),
]


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None]:
    """Maintain a pooled async HTTP client across requests for low-latency Ollama calls."""
    limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
    async with httpx.AsyncClient(limits=limits) as client:
        application.state.http_client = client
        yield


app = FastAPI(
    title=f"Kumanday • {settings.app_name}",
    version=settings.app_version,
    description="Agente ambiental e intérprete científico offline-first para el PNN Los Nevados.",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=512)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_pooled_client(request: Request) -> httpx.AsyncClient | None:
    client = getattr(request.app.state, "http_client", None)
    return client if isinstance(client, httpx.AsyncClient) else None


@app.get("/")
async def root() -> dict[str, str]:
    """Basic service metadata."""
    return {
        "agent": "Kumanday",
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }


@app.get("/api/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    """Verify local API readiness and Ollama model availability."""
    runtime_settings = get_settings()
    connected, models = await list_ollama_models(
        runtime_settings,
        http_client=_get_pooled_client(request),
    )
    kb = load_knowledge()
    return HealthResponse(
        agent_name="Kumanday",
        status="ok" if connected else "degraded",
        ollama_connected=connected,
        ollama_url=runtime_settings.ollama_base_url,
        configured_model=runtime_settings.ollama_model,
        configured_vision_model=runtime_settings.ollama_vision_model,
        model_available=(runtime_settings.ollama_model in models or any(
            model.split(":")[0] == runtime_settings.ollama_model.split(":")[0]
            for model in models
        )),
        active_models=models,
        species_count=len(kb.especies),
        offline_ready=True,
    )


@app.get("/api/rutas", response_model=list[Ruta])
async def get_rutas() -> JSONResponse:
    """Return the verified official trails of PNN Los Nevados."""
    rutas = [r.model_dump() for r in load_knowledge().rutas]
    return JSONResponse(content=rutas, headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/estaciones", response_model=list[Estacion])
async def get_estaciones() -> list[Estacion]:
    """Return the five interpretation stops and their UTON guide citations."""
    return UTON_STATIONS


@app.get("/api/fuentes/uton")
async def default_sources() -> dict[str, object]:
    """Return reviewed starter chunks from the two challenge source guides."""
    import json
    from pathlib import Path

    data_path = Path(__file__).parent / "data" / "uton_guides.json"
    documents = json.loads(data_path.read_text(encoding="utf-8"))
    reviewed_chunks = []
    for document in documents:
        for page in document["pages"]:
            clean = re.sub(r"\s+", " ", page["text"]).strip()
            for offset in range(0, len(clean), 900):
                text = clean[offset : offset + 900].strip()
                if text:
                    reviewed_chunks.append({"text": text, "page": page["page"], "source": document["name"]})
    return {
        "chunks": reviewed_chunks,
        "notice": "Las condiciones actuales de acceso, clima y actividad volcánica requieren confirmación del guía autorizado.",
    }


@app.post("/api/fuentes/uton")
async def upload_uton(file: UploadFile) -> dict[str, object]:
    """Validate and extract a local UTON guide for the current application session."""
    suffix = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if suffix not in SUPPORTED_GUIDE_SUFFIXES:
        raise HTTPException(status_code=415, detail="Formato no admitido. Usa PDF, TXT, CSV o DOCX.")
    content = await file.read(MAX_GUIDE_BYTES + 1)
    if len(content) > MAX_GUIDE_BYTES:
        raise HTTPException(status_code=413, detail="El archivo supera el máximo de 8 MiB.")
    try:
        if suffix == ".txt":
            pages = [content.decode("utf-8-sig")]
        elif suffix == ".csv":
            rows = csv.reader(io.StringIO(content.decode("utf-8-sig")))
            pages = ["\n".join(" | ".join(row) for row in rows)]
        elif suffix == ".pdf":
            reader = pymupdf.open(stream=content, filetype="pdf")
            pages = [page.get_text() for page in reader]
            if pages and "UTON" not in pages[0].upper() and "LOS NEVADOS" not in pages[0].upper():
                raise ValueError("El PDF no parece ser una fuente UTON del PNN Los Nevados.")
        else:
            from xml.etree import ElementTree
            from zipfile import ZipFile

            with ZipFile(io.BytesIO(content)) as archive:
                if "word/document.xml" not in archive.namelist():
                    raise ValueError("DOCX inválido")
                root = ElementTree.fromstring(archive.read("word/document.xml"))
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = ["".join(node.text or "" for node in p.findall(".//w:t", ns)) for p in root.findall(".//w:p", ns)]
            pages = ["\n".join(p for p in paragraphs if p.strip())]
        if suffix != ".pdf":
            joined_text = " ".join(pages[:3]).casefold()
            if not any(term in joined_text for term in ("uton", "nevados", "aguacerales", "arenales", "lunares")):
                raise ValueError("El archivo no parece contener una fuente del recorrido UTON.")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="No pude leer el archivo. Verifica que no esté dañado y vuelve a intentarlo.") from exc

    chunks: list[dict[str, object]] = []
    for page_number, page_text in enumerate(pages, start=1):
        clean = re.sub(r"\s+", " ", page_text).strip()
        for offset in range(0, len(clean), 900):
            text = clean[offset : offset + 900].strip()
            if text:
                chunks.append({"text": text, "page": page_number, "source": file.filename or "Fuente UTON"})
    if not chunks:
        raise HTTPException(status_code=422, detail="El archivo no contiene texto que pueda citar.")
    return {"filename": file.filename, "chunks": chunks, "pages": len(pages)}


@app.get("/api/especies", response_model=list[Especie])
async def get_especies() -> JSONResponse:
    """Return the verified 12-species catalog of PNN Los Nevados."""
    especies = [s.model_dump() for s in load_knowledge().especies]
    return JSONResponse(content=especies, headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/radar", response_model=RadarResponse)
async def get_radar(
    altitud: int = Query(default=4150, ge=0, le=6000, description="Altitud actual en m s.n.m."),
) -> RadarResponse:
    """Compute thermal floor, probable species, and altitude safety recommendations."""
    return calculate_radar(altitud)


@app.get("/api/protocolos")
async def get_protocolos() -> dict[str, object]:
    """Return life-saving protocols and offline Caldas emergency directory."""
    kb = load_knowledge()
    protocolos: dict[str, ProtocoloVida] = kb.protocolos_vida
    directorio: list[EmergenciaContacto] = kb.directorio_emergencias
    return {
        "protocolos_vida": protocolos,
        "directorio_emergencias": directorio,
    }


@app.post("/api/chat", response_model=ChatResponse)
async def post_chat(payload: ChatRequest, request: Request) -> ChatResponse:
    """Invoke Kumanday AI Agent grounded in verified PNNN tools via local Ollama."""
    runtime_settings = get_settings()
    return await generate_chat_response(
        payload,
        runtime_settings,
        http_client=_get_pooled_client(request),
    )


@app.post("/api/voice/transcribe")
async def transcribe_voice(
    request: Request,
    language: Literal["es", "en"] = Query(default="es"),
) -> dict[str, str]:
    """Transcribe a short WAV from a bounded request stream without temporary files."""
    if request.headers.get("content-type", "").split(";", 1)[0].strip() not in {
        "audio/wav",
        "audio/x-wav",
    }:
        raise HTTPException(status_code=415, detail="Envía el audio como WAV.")

    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_VOICE_BYTES:
            raise HTTPException(status_code=413, detail="El audio supera el límite de 1 MB.")
        content.extend(chunk)

    try:
        transcript = await asyncio.to_thread(
            transcribe_wav,
            bytes(content),
            get_settings().speech_model_path,
            language,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="El modelo local de voz no está instalado. Consulta las instrucciones del backend.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"transcript": transcript}


@app.post("/api/vision", response_model=VisionResponse)
async def post_vision(payload: VisionRequest, request: Request) -> VisionResponse:
    """Identify Andean flora/fauna strictly from validated JPG/PNG/WebP images."""
    runtime_settings = get_settings()
    try:
        return await analyze_species_image(
            payload,
            runtime_settings,
            http_client=_get_pooled_client(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
