"""Local, temporary speech-to-text processing for voice chat."""

import io
import os
import threading
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from pywhispercpp.model import Model

SAMPLE_RATE = 16_000
MAX_DURATION_SECONDS = 30
_model_lock = threading.Lock()


@lru_cache(maxsize=1)
def _load_model(model_path: str) -> Model:
    model_file = Path(model_path)
    if not model_file.is_file():
        raise FileNotFoundError(f"Local speech model not found: {model_file}")
    return Model(
        str(model_file.resolve()),
        n_threads=min(4, os.cpu_count() or 1),
        redirect_whispercpp_logs_to=None,
    )


def transcribe_wav(audio_bytes: bytes, model_path: str, language: str) -> str:
    """Transcribe a 16 kHz mono PCM WAV without writing audio to disk."""
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
            frame_count = wav_file.getnframes()
            sample_rate = wav_file.getframerate()
            if (
                wav_file.getcomptype() != "NONE"
                or wav_file.getnchannels() != 1
                or wav_file.getsampwidth() != 2
                or sample_rate != SAMPLE_RATE
            ):
                raise ValueError("El audio debe ser WAV PCM mono de 16 kHz.")
            duration = frame_count / sample_rate
            if frame_count == 0 or duration > MAX_DURATION_SECONDS:
                raise ValueError("El audio debe durar entre 0 y 30 segundos.")
            pcm_bytes = wav_file.readframes(frame_count)
    except (wave.Error, EOFError) as exc:
        raise ValueError("El audio WAV está dañado o no es válido.") from exc

    if len(pcm_bytes) != frame_count * 2:
        raise ValueError("El audio WAV está incompleto.")

    audio = np.frombuffer(pcm_bytes, dtype="<i2").astype(np.float32) / 32768.0
    if not np.any(audio):
        return ""

    with _model_lock:
        segments = _load_model(model_path).transcribe(
            audio,
            language=language,
            print_progress=False,
            print_realtime=False,
            print_timestamps=False,
        )
    return " ".join(segment.text.strip() for segment in segments).strip()
