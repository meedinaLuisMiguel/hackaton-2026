"""FastAPI entry point for Guia de Paramo Sin Senal (PNN Los Nevados)."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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
    HealthResponse,
    ProtocoloVida,
    RadarResponse,
    Ruta,
    VisionRequest,
    VisionResponse,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Asistente ambiental offline-first para el Parque Nacional Natural Los Nevados.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    """Basic service metadata."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Verify local API readiness and Ollama model availability."""
    runtime_settings = get_settings()
    connected, models = await list_ollama_models(runtime_settings)
    return HealthResponse(
        status="ok" if connected else "degraded",
        ollama_connected=connected,
        ollama_url=runtime_settings.ollama_base_url,
        configured_model=runtime_settings.ollama_model,
        configured_vision_model=runtime_settings.ollama_vision_model,
        active_models=models,
        offline_ready=True,
    )


@app.get("/api/rutas", response_model=list[Ruta])
async def get_rutas() -> list[Ruta]:
    """Return the verified official trails of PNN Los Nevados."""
    return load_knowledge().rutas


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
async def post_chat(payload: ChatRequest) -> ChatResponse:
    """Answer questions grounded in verified PNNN knowledge via local Ollama."""
    runtime_settings = get_settings()
    return await generate_chat_response(payload, runtime_settings)


@app.post("/api/vision", response_model=VisionResponse)
async def post_vision(payload: VisionRequest) -> VisionResponse:
    """Identify Andean flora/fauna from a base64 image using local Ollama vision."""
    runtime_settings = get_settings()
    try:
        return await analyze_species_image(payload, runtime_settings)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
