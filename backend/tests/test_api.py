"""API integration tests for FastAPI endpoints including Ollama mocks and offline fallbacks."""

import base64
import io
from unittest.mock import AsyncMock, patch

import httpx
from PIL import Image

from backend.main import app


def _make_sample_png_base64() -> str:
    img = Image.new("RGB", (120, 120), color=(45, 71, 57))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _asgi_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    )


async def test_get_rutas_and_protocolos() -> None:
    async with _asgi_client() as client:
        rutas_resp = await client.get("/api/rutas")
        assert rutas_resp.status_code == 200
        rutas = rutas_resp.json()
        assert len(rutas) == 3
        assert rutas[0]["id"] == "brisas-valle-tumbas"

        proto_resp = await client.get("/api/protocolos")
        assert proto_resp.status_code == 200
        data = proto_resp.json()
        assert "soroche" in data["protocolos_vida"]
        assert len(data["directorio_emergencias"]) == 3


async def test_get_radar_endpoint() -> None:
    async with _asgi_client() as client:
        resp = await client.get("/api/radar", params={"altitud": 4150})
    assert resp.status_code == 200
    body = resp.json()
    assert body["altitud_m"] == 4150
    assert body["piso_termico"]["piso"] == "Superpáramo"
    assert body["riesgo_soroche"] == "Muy Alto"


async def test_health_when_ollama_offline() -> None:
    with patch("backend.main.list_ollama_models", new=AsyncMock(return_value=(False, []))):
        async with _asgi_client() as client:
            resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["ollama_connected"] is False
    assert body["offline_ready"] is True


async def test_chat_fallback_when_ollama_unavailable() -> None:
    with patch(
        "backend.rag_engine._post_to_ollama",
        new=AsyncMock(side_effect=httpx.ConnectError("Connection refused")),
    ):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/chat",
                json={
                    "message": "Tengo dolor de cabeza a 4200 m",
                    "altitud_m": 4200,
                },
            )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fallback_used"] is True
    assert body["safety_alert"] is True
    assert "DESCENDER" in body["reply"]


async def test_chat_uses_ollama_response_when_available() -> None:
    mock_payload = {"message": {"content": "El frailejón captura gotas de neblina con sus hojas."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock_payload)):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "¿Cómo produce agua el frailejón?", "altitud_m": 3850},
            )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fallback_used"] is False
    assert "frailejón" in body["reply"].lower()


async def test_vision_with_ollama_mock_and_invalid_image() -> None:
    async with _asgi_client() as client:
        bad_resp = await client.post("/api/vision", json={"image_base64": "not-valid-base64!!!"})
    assert bad_resp.status_code == 422

    mock_vision = {
        "message": {
            "content": (
                '{"especie_id": "frailejon", "nombre_comun": "Frailejón del Ruiz", '
                '"nombre_cientifico": "Espeletia hartwegiana", "tipo": "Flora", '
                '"confianza": "Alta", "descripcion": "Roseta vellosa adaptada al páramo."}'
            )
        }
    }
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock_vision)):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/vision",
                json={"image_base64": _make_sample_png_base64(), "altitud_m": 3950},
            )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fallback_used"] is False
    assert body["nombre_cientifico"] == "Espeletia hartwegiana"


async def test_vision_fallback_with_hint_when_ollama_offline() -> None:
    with patch(
        "backend.rag_engine._post_to_ollama",
        new=AsyncMock(side_effect=httpx.ConnectError("Connection refused")),
    ):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/vision",
                json={
                    "image_base64": _make_sample_png_base64(),
                    "altitud_m": 4100,
                    "hint": "chivito",
                },
            )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fallback_used"] is True
    assert body["nombre_cientifico"] == "Oxypogon stubelii"
