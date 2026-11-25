"""FastAPI entry point for Kumanday — Agente IA del PNN Los Nevados."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
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
    HealthResponse,
    ProtocoloVida,
    RadarResponse,
    Ruta,
    VisionRequest,
    VisionResponse,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
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
        active_models=models,
        species_count=len(kb.especies),
        offline_ready=True,
    )


@app.get("/api/rutas", response_model=list[Ruta])
async def get_rutas() -> JSONResponse:
    """Return the verified official trails of PNN Los Nevados."""
    rutas = [r.model_dump() for r in load_knowledge().rutas]
    return JSONResponse(content=rutas, headers={"Cache-Control": "public, max-age=3600"})


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
