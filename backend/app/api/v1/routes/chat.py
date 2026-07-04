from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_container
from app.chat.schemas import ChatCompletionRequest
from app.core.container import ApplicationContainer

router = APIRouter()


@router.post("/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    container: ApplicationContainer = Depends(get_container),
) -> StreamingResponse:
    chat_service = container.chat_service()

    async def event_stream() -> object:
        async for chunk in chat_service.stream_completion(request):
            yield f"data: {chunk.model_dump_json()}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
