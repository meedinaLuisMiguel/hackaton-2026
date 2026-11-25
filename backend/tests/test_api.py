"""API integration tests for Kumanday Agent, strict Vision validation, and offline fallbacks."""

import base64
import io
from unittest.mock import AsyncMock, patch

import httpx
from PIL import Image

from backend.main import app


def _make_sample_png_base64(size: tuple[int, int] = (120, 120)) -> str:
    img = Image.new("RGB", size, color=(45, 71, 57))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _asgi_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    )


async def test_get_rutas_especies_and_protocolos() -> None:
    async with _asgi_client() as client:
        rutas_resp = await client.get("/api/rutas")
        assert rutas_resp.status_code == 200
        rutas = rutas_resp.json()
        assert len(rutas) == 3
        assert rutas[0]["id"] == "brisas-valle-tumbas"

        especies_resp = await client.get("/api/especies")
        assert especies_resp.status_code == 200
        assert len(especies_resp.json()) == 12

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
    assert body["agent_name"] == "Kumanday"
    assert body["species_count"] == 12
    assert body["status"] == "degraded"
    assert body["ollama_connected"] is False
    assert body["offline_ready"] is True


async def test_chat_general_question_is_answered_with_scope_notice() -> None:
    mock = {"message": {"content": "JavaScript es un lenguaje de programación. Mi especialidad es Los Nevados."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "¿Qué es JavaScript?", "altitud_m": 4000},
            )
    assert resp.status_code == 200
    assert resp.json()["out_of_domain"] is True
    assert "consulta_general" in resp.json()["tools_used"]


async def test_chat_general_offline_explains_local_specialty() -> None:
    with patch(
        "backend.rag_engine._post_to_ollama",
        new=AsyncMock(side_effect=httpx.ConnectError("Connection refused")),
    ):
        async with _asgi_client() as client:
            resp = await client.post("/api/chat", json={"message": "Cuéntame un chiste"})
    assert resp.status_code == 200
    assert resp.json()["fallback_used"] is True
    assert "especialidad" in resp.json()["reply"]


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
    assert body["suggested_action"] == "open_safety"
    assert "activar_protocolo_vida" in body["tools_used"]
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
    assert body["agent_name"] == "Kumanday"
    assert body["fallback_used"] is False
    assert "consultar_especie" in body["tools_used"]
    assert "frailejón" in body["reply"].lower()


async def test_vision_strict_format_validation_and_frailejon_match() -> None:
    async with _asgi_client() as client:
        bad_b64 = await client.post("/api/vision", json={"image_base64": "not-valid-base64!!!"})
        bad_mime = await client.post(
            "/api/vision",
            json={"image_base64": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="},
        )
        too_small = await client.post(
            "/api/vision",
            json={"image_base64": _make_sample_png_base64((16, 16))},
        )
    assert bad_b64.status_code == 422
    assert bad_mime.status_code == 422
    assert too_small.status_code == 422

    mismatched_mime = _make_sample_png_base64().split(",", 1)[1]
    async with _asgi_client() as client:
        mismatch_resp = await client.post(
            "/api/vision",
            json={"image_base64": f"data:image/jpeg;base64,{mismatched_mime}"},
        )
    assert mismatch_resp.status_code == 422

    mock_vision = {
        "message": {
            "content": (
                '{"objeto_detectado": "Frailejón del Ruiz", "es_especie_pnnn": true, '
                '"especie_id": "frailejon", "categoria": "Flora", '
                '"confianza": "Alta", "observacion": "Roseta vellosa adaptada al páramo."}'
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
    assert body["en_pnnn"] is True
    assert body["fallback_used"] is False
    assert body["nombre_cientifico"] == "Espeletia hartwegiana"


async def test_vision_blocks_tiger_misclassification_as_bear() -> None:
    # Even if a small model confuses a tiger with 'oso', the non-PNNN subject guardrail blocks it
    mock_confused_tiger = {
        "message": {
            "content": (
                '{"objeto_detectado": "Tigre de bengala", "es_especie_pnnn": true, '
                '"especie_id": "oso", "categoria": "Fauna", '
                '"confianza": "Media", "observacion": "Felino rayado naranja y negro."}'
            )
        }
    }
    with patch(
        "backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock_confused_tiger)
    ):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/vision",
                json={"image_base64": _make_sample_png_base64(), "altitud_m": 3200},
            )
    assert resp.status_code == 200
    body = resp.json()
    assert body["en_pnnn"] is False
    assert body["tipo"] == "Fuera de Ecosistema"
    assert "Tigre" in body["nombre_comun"]
    assert "Tremarctos ornatus" not in body["nombre_cientifico"]


async def test_vision_unknown_positive_species_is_not_confirmed() -> None:
    response = {
        "message": {
            "content": (
                '{"objeto_detectado":"animal desconocido","es_especie_pnnn":true,'
                '"especie_id":"inventada","categoria":"Fauna",'
                '"confianza":"Alta","observacion":"Un mamífero."}'
            )
        }
    }
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=response)):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/vision", json={"image_base64": _make_sample_png_base64()}
            )
    assert resp.status_code == 200
    assert resp.json()["en_pnnn"] is False
    assert resp.json()["tipo"] == "Sin Confirmación"


async def test_vision_offline_behavior_with_and_without_hint() -> None:
    with patch(
        "backend.rag_engine._post_to_ollama",
        new=AsyncMock(side_effect=httpx.ConnectError("Connection refused")),
    ):
        async with _asgi_client() as client:
            with_hint = await client.post(
                "/api/vision",
                json={
                    "image_base64": _make_sample_png_base64(),
                    "altitud_m": 4100,
                    "hint": "chivito",
                },
            )
            without_hint = await client.post(
                "/api/vision",
                json={
                    "image_base64": _make_sample_png_base64(),
                    "altitud_m": 4100,
                },
            )
    assert with_hint.status_code == 200
    assert with_hint.json()["en_pnnn"] is True
    assert with_hint.json()["nombre_cientifico"] == "Oxypogon stubelii"

    assert without_hint.status_code == 200
    assert without_hint.json()["en_pnnn"] is False
    assert without_hint.json()["tipo"] == "Sin Confirmación"
