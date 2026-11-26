import io
import wave
from unittest.mock import patch

import pytest

from backend.speech import transcribe_wav


def _make_wav(sample_rate: int, duration_seconds: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * sample_rate * duration_seconds)
    return buffer.getvalue()


def test_transcribe_rejects_audio_over_30_seconds_without_loading_model() -> None:
    with patch("backend.speech._load_model") as load_model, pytest.raises(
        ValueError, match="30 segundos"
    ):
        transcribe_wav(_make_wav(16_000, 31), "missing-model.bin", "es")

    load_model.assert_not_called()


def test_transcribe_rejects_non_16khz_audio_without_loading_model() -> None:
    with patch("backend.speech._load_model") as load_model, pytest.raises(
        ValueError, match="16 kHz"
    ):
        transcribe_wav(_make_wav(8_000, 1), "missing-model.bin", "en")

    load_model.assert_not_called()


def test_transcribe_returns_empty_for_silence_without_loading_model() -> None:
    with patch("backend.speech._load_model") as load_model:
        transcript = transcribe_wav(_make_wav(16_000, 1), "missing-model.bin", "es")

    assert transcript == ""
    load_model.assert_not_called()
