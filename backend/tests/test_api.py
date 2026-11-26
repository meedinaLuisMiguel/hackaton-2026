"""API integration tests for Kumanday Agent, strict Vision validation, and offline fallbacks."""

import base64
import io
import wave
from pathlib import Path
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


def _make_voice_wav() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16_000)
        wav_file.writeframes(b"\x00\x00" * 16_000)
    return buffer.getvalue()


def _bundled_sample_base64(name: str) -> str:
    image_path = Path(__file__).resolve().parents[2] / "frontend" / "public" / "samples" / f"{name}.jpg"
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


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


async def test_estaciones_are_grounded_in_uton_guides() -> None:
    async with _asgi_client() as client:
        response = await client.get("/api/estaciones")
    assert response.status_code == 200
    stations = response.json()
    assert [item["id"] for item in stations] == ["brisas", "aguacerales", "arenales", "lunares", "valle-tumbas"]
    assert all(item["fuentes"] for item in stations)


async def test_uton_upload_extracts_text_and_page() -> None:
    async with _asgi_client() as client:
        response = await client.post("/api/fuentes/uton", files={"file": ("guia.txt", "Aguacerales conserva agua del páramo", "text/plain")})
    assert response.status_code == 200
    body = response.json()
    assert body["chunks"][0]["page"] == 1
    assert "Aguacerales" in body["chunks"][0]["text"]


async def test_voice_transcription_uses_local_model_and_selected_language() -> None:
    wav_data = _make_voice_wav()
    with patch("backend.main.transcribe_wav", return_value="¿Qué hace el frailejón?") as transcribe:
        async with _asgi_client() as client:
            response = await client.post(
                "/api/voice/transcribe?language=es",
                content=wav_data,
                headers={"Content-Type": "audio/wav"},
            )

    assert response.status_code == 200
    assert response.json() == {"transcript": "¿Qué hace el frailejón?"}
    transcribe.assert_called_once()
    assert transcribe.call_args.args[0] == wav_data
    assert transcribe.call_args.args[2] == "es"


async def test_voice_transcription_rejects_bad_media_and_oversized_uploads() -> None:
    async with _asgi_client() as client:
        wrong_type = await client.post(
            "/api/voice/transcribe",
            content=b"audio",
            headers={"Content-Type": "audio/webm"},
        )
        invalid_wav = await client.post(
            "/api/voice/transcribe",
            content=b"not a wav",
            headers={"Content-Type": "audio/wav"},
        )
        oversized = await client.post(
            "/api/voice/transcribe",
            content=b"\x00" * 1_000_001,
            headers={"Content-Type": "audio/wav"},
        )

    assert wrong_type.status_code == 415
    assert invalid_wav.status_code == 422
    assert oversized.status_code == 413


async def test_voice_transcription_reports_missing_local_model() -> None:
    with patch("backend.main.transcribe_wav", side_effect=FileNotFoundError("missing")):
        async with _asgi_client() as client:
            response = await client.post(
                "/api/voice/transcribe",
                content=_make_voice_wav(),
                headers={"Content-Type": "audio/wav"},
            )

    assert response.status_code == 503
    assert "modelo local de voz" in response.json()["detail"]


async def test_chat_abstains_without_cited_uton_evidence() -> None:
    async with _asgi_client() as client:
        response = await client.post("/api/chat", json={"message": "¿Cuál es el estado del volcán hoy?", "guide_chunks": [{"text": "El volcán está activo", "page": 7, "source": "Guion UTON"}]})
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_evidence"] is True
    assert "guía experto autorizado" in body["reply"]
    assert body["sources"] == []


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


async def test_chat_broad_biodiversity_question_uses_local_species_catalog() -> None:
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock()) as ollama:
        async with _asgi_client() as client:
            response = await client.post(
                "/api/chat",
                json={
                    "message": "¿No hay ningún ser vivo o especie?",
                    "guide_chunks": [
                        {
                            "text": "El guía menciona una especie en el recorrido del Valle Lunar.",
                            "page": 8,
                            "source": "Guion Ecoturístico UTON 2024",
                            "citation": "Guion Ecoturístico UTON 2024 · p. 8",
                        }
                    ],
                },
            )

    assert response.status_code == 200
    body = response.json()
    assert "12" in body["reply"]
    assert "Frailejón del Ruiz" in body["reply"]
    assert "No conozco" not in body["reply"]
    assert body["sources"] == ["Catálogo local de especies PNN Los Nevados"]
    assert "Guion Ecoturístico" not in body["reply"]
    assert body["insufficient_evidence"] is True
    assert body["out_of_domain"] is False
    ollama.assert_not_awaited()


async def test_chat_plural_species_query_matches_local_catalog_entry() -> None:
    mock = {"message": {"content": "El catálogo local registra el Frailejón del Ruiz."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)):
        async with _asgi_client() as client:
            response = await client.post(
                "/api/chat",
                json={"message": "¿Hay frailejones en el parque?"},
            )

    assert response.status_code == 200
    body = response.json()
    assert "Frailejón del Ruiz" in body["reply"]
    assert body["sources"] == ["Frailejón del Ruiz"]
    assert "no una cita UTON" in body["reply"]


async def test_chat_uncovered_ecology_answer_is_labeled_as_general_and_unverified() -> None:
    mock = {"message": {"content": "Los hongos descomponen materia orgánica y reciclan nutrientes."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)) as ollama:
        async with _asgi_client() as client:
            response = await client.post(
                "/api/chat",
                json={"message": "¿Qué función cumplen los hongos del páramo?"},
            )

    assert response.status_code == 200
    body = response.json()
    assert "reciclan nutrientes" in body["reply"]
    assert "no está validada por UTON" in body["reply"]
    assert body["sources"] == ["Respuesta general de IA local · no validada por UTON"]
    assert body["insufficient_evidence"] is True
    assert body["out_of_domain"] is False
    call = ollama.await_args
    assert call is not None
    prompt = call.args[1]["messages"][0]["content"]
    assert "no deduzcas" in prompt.lower()
    assert "presencia" in prompt.lower()


async def test_chat_uncovered_ecology_answers_in_selected_english() -> None:
    mock = {"message": {"content": "Lichens help stabilize exposed soils."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)):
        async with _asgi_client() as client:
            response = await client.post(
                "/api/chat",
                json={
                    "message": "What role do lichens play in the superpáramo?",
                    "language": "en",
                },
            )

    assert response.status_code == 200
    body = response.json()
    assert "stabilize exposed soils" in body["reply"]
    assert "not validated by UTON" in body["reply"]
    assert body["sources"] == ["General local AI response · not validated by UTON"]


async def test_chat_sustainability_does_not_trigger_safety_abstention() -> None:
    mock = {"message": {"content": "La sostenibilidad busca conservar recursos a largo plazo."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)):
        async with _asgi_client() as client:
            response = await client.post(
                "/api/chat",
                json={"message": "¿Qué significa sostenibilidad en el páramo?"},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["safety_alert"] is False
    assert body["suggested_action"] == "none"
    assert "no está validada por UTON" in body["reply"]


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
    assert "guía experto autorizado" in body["reply"]
    assert body["sources"] == []


async def test_chat_uses_ollama_response_when_available() -> None:
    mock_payload = {"message": {"content": "El frailejón captura gotas de neblina con sus hojas."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock_payload)):
        async with _asgi_client() as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "¿Cómo produce agua el frailejón?", "altitud_m": 3850, "guide_chunks": [{"text": "El frailejón capta humedad con sus hojas vellosas y ayuda a regular el agua.", "page": 5, "source": "Guion Ecoturístico UTON 2024"}]},
            )
    assert resp.status_code == 200
    body = resp.json()
    assert body["agent_name"] == "Kumanday"
    assert body["fallback_used"] is False
    assert "recuperar_fragmentos_uton" in body["tools_used"]
    assert "frailejón" in body["reply"].lower()


async def test_general_chat_is_answered_by_local_model_with_scope_reminder() -> None:
    mock = {"message": {"content": "Una silla es un mueble para sentarse. Mi especialidad es Los Nevados."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)) as ollama:
        async with _asgi_client() as client:
            resp = await client.post("/api/chat", json={"message": "¿Qué es una silla?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["out_of_domain"] is True
    assert "especialidad" in body["reply"].lower()
    assert body["model"] == "gemma3:4b"
    ollama.assert_awaited_once()


async def test_species_question_does_not_suggest_opening_routes() -> None:
    mock = {"message": {"content": "El frailejón es una planta nativa del páramo."}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)):
        async with _asgi_client() as client:
            resp = await client.post("/api/chat", json={"message": "¿Qué hace el frailejón?"})
    assert resp.status_code == 200
    assert resp.json()["suggested_action"] == "none"


async def test_vision_recognizes_everyday_object_with_park_focus_note() -> None:
    mock = {"message": {"content": (
        '{"objeto_detectado":"Silla","es_especie_pnnn":false,'
        '"especie_id":"ninguna","categoria":"No pertenece al PNNN",'
        '"confianza":"Alta","observacion":"Es una silla de madera."}'
    )}}
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=mock)):
        async with _asgi_client() as client:
            resp = await client.post("/api/vision", json={"image_base64": _make_sample_png_base64()})
    assert resp.status_code == 200
    body = resp.json()
    assert body["tipo"] == "Objeto"
    assert body["nombre_comun"] == "Silla"
    assert "especialidad" in body["enfoque_notice"]


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


async def test_vision_uses_known_frailejon_sample_if_model_cannot_map_it() -> None:
    uncertain = {
        "message": {
            "content": (
                '{"objeto_detectado":"Planta con hojas plateadas y flores amarillas",'
                '"es_especie_pnnn":false,"especie_id":"ninguna","categoria":"Flora",'
                '"confianza":"Alta","observacion":"Roseta con flores amarillas."}'
            )
        }
    }
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=uncertain)):
        async with _asgi_client() as client:
            response = await client.post(
                "/api/vision",
                json={
                    "image_base64": _bundled_sample_base64("frailejon"),
                    "hint": "sample:frailejon",
                },
            )

    assert response.status_code == 200
    body = response.json()
    assert body["en_pnnn"] is True
    assert body["nombre_comun"] == "Frailejón del Ruiz"
    assert body["nombre_cientifico"] == "Espeletia hartwegiana"
    assert body["confianza"] == "Catálogo Offline Verificado"
    assert body["fallback_used"] is True


async def test_vision_does_not_trust_sample_hint_for_an_uploaded_image() -> None:
    uncertain = {
        "message": {
            "content": (
                '{"objeto_detectado":"Planta sin identificar","es_especie_pnnn":false,'
                '"especie_id":"ninguna","categoria":"Flora","confianza":"Baja",'
                '"observacion":"No hay rasgos suficientes para confirmar la especie."}'
            )
        }
    }
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=uncertain)):
        async with _asgi_client() as client:
            response = await client.post(
                "/api/vision",
                json={
                    "image_base64": _make_sample_png_base64(),
                    "hint": "sample:frailejon",
                },
            )

    assert response.status_code == 200
    body = response.json()
    assert body["en_pnnn"] is False
    assert body["tipo"] == "Sin Confirmación"
    assert body["nombre_comun"] != "Frailejón del Ruiz"


async def test_vision_normalizes_numeric_confidence_for_catalog_match() -> None:
    identified = {
        "message": {
            "content": (
                '{"objeto_detectado":"Frailejón","es_especie_pnnn":true,'
                '"especie_id":"frailejon","categoria":"Flora",'
                '"confianza":0.85,"observacion":"Roseta de hojas plateadas y flores amarillas."}'
            )
        }
    }
    with patch("backend.rag_engine._post_to_ollama", new=AsyncMock(return_value=identified)) as ollama:
        async with _asgi_client() as client:
            response = await client.post(
                "/api/vision",
                json={"image_base64": _bundled_sample_base64("frailejon")},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["en_pnnn"] is True
    assert body["nombre_cientifico"] == "Espeletia hartwegiana"
    assert body["confianza"] == "Alta"
    call = ollama.await_args
    assert call is not None
    prompt = call.args[1]["messages"][0]["content"]
    assert "roseta" in prompt.lower()
    assert "vellosas" in prompt.lower()


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
                    "image_base64": _bundled_sample_base64("chivito"),
                    "altitud_m": 4100,
                    "hint": "sample:chivito",
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


async def test_english_safety_question_abstains_in_english() -> None:
    async with _asgi_client() as client:
        response = await client.post(
            "/api/chat",
            json={"message": "I have a headache and feel dizzy", "language": "en"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["safety_alert"] is True
    assert body["suggested_action"] == "open_safety"
    assert "authorized expert guide" in body["reply"]
    assert "No conozco" not in body["reply"]


async def test_vision_uses_requested_language_for_generated_observation() -> None:
    response_payload = {
        "message": {
            "content": (
                '{"objeto_detectado":"buffy helmetcrest","es_especie_pnnn":true,'
                '"especie_id":"chivito","categoria":"Fauna","confianza":"Alta",'
                '"observacion":"A hummingbird is perched on a frailejón flower."}'
            )
        }
    }
    ollama = AsyncMock(return_value=response_payload)
    with patch("backend.rag_engine._post_to_ollama", new=ollama):
        async with _asgi_client() as client:
            response = await client.post(
                "/api/vision",
                json={
                    "image_base64": _make_sample_png_base64(),
                    "language": "en",
                },
            )

    assert response.status_code == 200
    assert "A hummingbird" in response.json()["descripcion_ia"]
    prompt = ollama.call_args.args[1]["messages"][0]["content"]
    assert "Write all user-facing text values in English" in prompt
