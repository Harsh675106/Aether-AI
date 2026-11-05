from __future__ import annotations

import asyncio
import os
import tempfile
import threading
import time
from typing import Any

import av
from app.core.logging import get_logger
from app.core.settings import Settings
from app.voice.schemas import VoiceTranscriptionResponse

# Faster-Whisper passes a PyAV option removed in recent PyAV versions.
_orig_av_open = av.open


def _compat_av_open(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return _orig_av_open(*args, **kwargs)


av.open = _compat_av_open

logger = get_logger(__name__)
MIN_AUDIO_BYTES = 100


class VoiceTranscriptionBusyError(RuntimeError):
    """Raised when another recording is already being transcribed."""


class VoiceService:
    """Production-grade local speech-to-text service using Faster-Whisper."""

    _instance: VoiceService | None = None
    _lock = threading.Lock()

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        self.model_size = getattr(self.settings, "voice_model_size", "base")
        self.device = getattr(self.settings, "voice_device", "cpu")
        self.compute_type = getattr(self.settings, "voice_compute_type", "int8")
        self.cpu_threads = getattr(self.settings, "voice_cpu_threads", 4)
        self._model: Any | None = None
        self._model_error: str | None = None
        self._init_lock = threading.Lock()
        self._transcription_lock = threading.Lock()

    @classmethod
    def get_instance(cls, settings: Settings | None = None) -> VoiceService:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(settings=settings)
        return cls._instance

    async def load_model(self) -> None:
        """Load the model in a worker thread during application startup."""
        await asyncio.to_thread(self._load_model_sync)

    def _load_model_sync(self) -> None:
        if self._model is not None:
            return

        with self._init_lock:
            if self._model is not None:
                return

            logger.info(
                "loading_faster_whisper_model",
                model_size=self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )
            try:
                from faster_whisper import WhisperModel

                start_t = time.perf_counter()
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                    cpu_threads=self.cpu_threads,
                    download_root=os.path.expanduser("~/.cache/huggingface/hub"),
                )
                self._model_error = None
                duration = round(time.perf_counter() - start_t, 2)
                logger.info("faster_whisper_model_ready", duration_seconds=duration)
            except Exception as exc:
                self._model_error = str(exc)
                logger.exception("faster_whisper_model_load_failed", error=str(exc))
                raise

    def is_ready(self) -> bool:
        return self._model is not None

    @property
    def model_error(self) -> str | None:
        return self._model_error

    def shutdown(self) -> None:
        self._model = None
        logger.info("faster_whisper_model_unloaded")

    async def transcribe_audio_bytes(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
    ) -> VoiceTranscriptionResponse:
        """Transcribe audio bytes asynchronously using Faster-Whisper in a worker thread."""
        if not audio_bytes or len(audio_bytes) < MIN_AUDIO_BYTES:
            return VoiceTranscriptionResponse(
                text="",
                language="en",
                language_probability=0.0,
                duration=0.0,
                executed_command=False,
            )

        if self._model is None:
            if self._model_error:
                raise RuntimeError(f"Speech model failed to load: {self._model_error}")
            raise RuntimeError("Speech model is still loading. Please try again shortly.")

        return await asyncio.to_thread(self._transcribe_sync, audio_bytes, filename)

    def _transcribe_sync(
        self,
        audio_bytes: bytes,
        filename: str,
    ) -> VoiceTranscriptionResponse:
        if not audio_bytes or len(audio_bytes) < MIN_AUDIO_BYTES:
            return VoiceTranscriptionResponse(
                text="",
                language="en",
                language_probability=0.0,
                duration=0.0,
                executed_command=False,
            )

        model = self._model
        if model is None:
            raise RuntimeError("Speech model is not loaded.")

        # Write audio bytes to a temporary file for PyAV/ctranslate2 decoding
        suffix = os.path.splitext(filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
            tmp_path = tmp_file.name
            tmp_file.write(audio_bytes)

        try:
            start_t = time.perf_counter()

            if not self._transcription_lock.acquire(blocking=False):
                raise VoiceTranscriptionBusyError(
                    "A recording is already being transcribed. Please wait and try again."
                )
            try:
                segments, info = model.transcribe(
                    tmp_path,
                    beam_size=5,
                    language=None,
                    vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 400},
                )
                full_text_pieces = [text for segment in segments if (text := segment.text.strip())]
            finally:
                self._transcription_lock.release()

            transcript = " ".join(full_text_pieces).strip()
            elapsed = round(time.perf_counter() - start_t, 3)

            logger.info(
                "audio_transcribed",
                transcript_length=len(transcript),
                detected_language=info.language,
                language_probability=round(info.language_probability, 3),
                duration=round(info.duration, 2),
                processing_time=elapsed,
            )

            return VoiceTranscriptionResponse(
                text=transcript,
                language=info.language,
                language_probability=float(info.language_probability),
                duration=float(info.duration),
                executed_command=False,
            )
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
