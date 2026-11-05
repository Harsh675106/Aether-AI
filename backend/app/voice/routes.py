from __future__ import annotations

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer
from app.core.logging import get_logger
from app.voice.commands import VoiceCommandExecutor
from app.voice.schemas import VoiceHealthResponse, VoiceTranscriptionResponse
from app.voice.service import VoiceService, VoiceTranscriptionBusyError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

logger = get_logger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])
MAX_AUDIO_BYTES = 25 * 1024 * 1024


@router.get("/health", response_model=VoiceHealthResponse)
async def voice_health(
    container: ApplicationContainer = Depends(get_container),  # noqa: B008
) -> VoiceHealthResponse:
    """Return health and configuration of the local Faster-Whisper voice engine."""
    voice_service = VoiceService.get_instance(container.settings)
    if voice_service.model_error:
        return VoiceHealthResponse(
            status="error",
            model_size=voice_service.model_size,
            device=voice_service.device,
            compute_type=voice_service.compute_type,
            vad_enabled=True,
            error="The local speech model could not be loaded.",
        )
    return VoiceHealthResponse(
        status="ready" if voice_service.is_ready() else "loading",
        model_size=voice_service.model_size,
        device=voice_service.device,
        compute_type=voice_service.compute_type,
        vad_enabled=True,
        error=None,
    )


@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),  # noqa: B008
    container: ApplicationContainer = Depends(get_container),  # noqa: B008
) -> VoiceTranscriptionResponse:
    """Transcribe user-recorded speech audio using local Faster-Whisper."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file must have a filename.",
        )

    try:
        content = await file.read(MAX_AUDIO_BYTES + 1)
        if len(content) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio recording exceeds the 25 MB limit.",
            )
        if not content:
            return VoiceTranscriptionResponse(
                text="",
                language="en",
                language_probability=0.0,
                duration=0.0,
                executed_command=False,
            )

        voice_service = VoiceService.get_instance(container.settings)
        result = await voice_service.transcribe_audio_bytes(content, filename=file.filename)
        return result
    except HTTPException:
        raise
    except VoiceTranscriptionBusyError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        logger.warning("transcription_unavailable", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("transcription_endpoint_failed", error=str(exc), exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech transcription failed: {exc}",
        ) from exc


@router.post("/execute")
async def execute_voice_command(transcript: str) -> dict[str, str | bool | None]:
    """Execute a structured voice command (e.g. 'open calculator', 'what is today's date')."""
    cmd = VoiceCommandExecutor.execute(transcript)
    return {
        "handled": cmd.handled,
        "message": cmd.message,
        "action_type": cmd.action_type,
    }
