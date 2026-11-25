"""Pydantic schemas for Kumanday — Agente IA del PNN Los Nevados."""

from typing import Literal

from pydantic import BaseModel, Field


class Coordenadas(BaseModel):
    """Geographic coordinates for trailheads and GPS anchors."""

    lat: float
    lon: float


class Ruta(BaseModel):
    """Official hiking trail inside PNN Los Nevados."""

    id: str
    nombre: str
    sector: str
    altitud_rango: str
    altitud_min_m: int
    altitud_max_m: int
    distancia_km: float
    dificultad: str
    coordenadas: Coordenadas
    estaciones: list[str]
    reglas: str


class PisoTermico(BaseModel):
    """Andean ecological elevation belt."""

    piso: str
    min_m: int
    max_m: int
    temp: str
    descripcion: str
    especies_clave: list[str]


class Especie(BaseModel):
    """Verified flora or fauna species of PNN Los Nevados."""

    id: str
    nombre_comun: str
    nombre_cientifico: str
    tipo: Literal["Flora", "Fauna"]
    estado: str
    pisos: list[str] = Field(default_factory=list)
    rol_ecologico: str
    alerta_conservacion: str


class ProtocoloVida(BaseModel):
    """Life-saving high-mountain safety protocol."""

    titulo: str
    sintomas: list[str]
    accion_inmediata: str


class EmergenciaContacto(BaseModel):
    """Offline emergency directory contact in Caldas."""

    id: str
    entidad: str
    descripcion: str
    canal: str
    telefono_display: str
    telefono_uri: str


class KnowledgeBase(BaseModel):
    """Complete verified scientific knowledge base."""

    rutas: list[Ruta]
    pisos_termicos: list[PisoTermico]
    especies: list[Especie]
    protocolos_vida: dict[str, ProtocoloVida]
    directorio_emergencias: list[EmergenciaContacto]


class HealthResponse(BaseModel):
    """Health check status including local Ollama availability."""

    agent_name: str = "Kumanday"
    status: Literal["ok", "degraded"]
    ollama_connected: bool
    ollama_url: str
    configured_model: str
    configured_vision_model: str
    active_models: list[str]
    species_count: int = 12
    offline_ready: bool = True


class RadarResponse(BaseModel):
    """Ecological and safety calculation for a given altitude."""

    altitud_m: int
    piso_termico: PisoTermico
    especies_probables: list[Especie]
    riesgo_soroche: Literal["Bajo", "Moderado", "Alto", "Muy Alto"]
    recomendacion_seguridad: str


class ChatMessage(BaseModel):
    """Single message turn in conversation history."""

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    """Request payload for Kumanday AI Agent."""

    message: str = Field(..., min_length=1, max_length=1500)
    altitud_m: int | None = Field(default=None, ge=0, le=6000)
    ruta_id: str | None = None
    last_species: str | None = Field(default=None, max_length=120)
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)


class ChatResponse(BaseModel):
    """Structured response from Kumanday AI Agent."""

    agent_name: str = "Kumanday"
    reply: str
    sources: list[str]
    tools_used: list[str] = Field(default_factory=list)
    suggested_action: Literal["none", "open_safety", "open_rutas", "open_vision"] = "none"
    out_of_domain: bool = False
    model: str
    fallback_used: bool = False
    safety_alert: bool = False


class VisionRequest(BaseModel):
    """Base64 image payload for strict species identification."""

    # Base64 overhead for an 8 MiB image is ~11.2 MiB; cap JSON allocation early.
    image_base64: str = Field(..., min_length=16, max_length=11_300_000)
    altitud_m: int | None = Field(default=None, ge=0, le=6000)
    hint: str | None = Field(default=None, max_length=120)


class VisionResponse(BaseModel):
    """Structured species identification and conservation alert."""

    en_pnnn: bool = True
    nombre_comun: str
    nombre_cientifico: str
    tipo: Literal["Flora", "Fauna", "Entorno", "Fuera de Ecosistema", "Sin Confirmación"]
    estado: str
    rol_ecologico: str
    alerta_conservacion: str
    confianza: str
    descripcion_ia: str
    model: str
    fallback_used: bool = False
