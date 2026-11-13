# Backend

FastAPI backend foundation for Aether AI using Python 3.13, Pydantic v2, SQLAlchemy async, Alembic, structured logging, and clean architecture boundaries.

## Structure

- `app/api/` - HTTP routers and versioned API surface.
- `app/videos/` - SearXNG video search, result normalization, command routing, and saved-video storage.
- `app/core/` - Application lifecycle, dependency injection, logging, and security.
- `app/agents/` - Agent interfaces and orchestration placeholders.
- `app/tools/` - Tool registry interfaces.
- `app/memory/` - Memory manager interfaces.
- `app/rag/` - Retrieval interfaces.
- `app/database/` - SQLAlchemy, Alembic, PostgreSQL, Redis, and ChromaDB configuration boundaries.
- `app/models/` - ORM models.
- `app/schemas/` - Pydantic schemas.
- `app/services/` - Application services.
- `app/repositories/` - Data access interfaces and implementations.
- `app/config/` - Runtime configuration helpers.
- `app/utils/` - Shared utilities.
- `app/middleware/` - HTTP middleware.
- `app/plugins/` - MCP-compatible plugin architecture placeholders.
- `app/workers/` - Background worker placeholders.

## Local voice engine

The frontend records audio and uploads it to `/api/v1/voice/transcribe`.
Faster-Whisper runs locally with the `base` model, CPU INT8, automatic language
detection, and Faster-Whisper's Silero VAD filter. The model loads once during
backend startup. The first run downloads the model; subsequent speech
recognition is local and does not use a browser speech service. Configure
`AETHER_VOICE_MODEL_SIZE`, `AETHER_VOICE_DEVICE`, `AETHER_VOICE_COMPUTE_TYPE`,
and `AETHER_VOICE_CPU_THREADS` to change the model settings.

## Video discovery

Video searches use `SEARXNG_BASE_URL` (default `http://localhost:8080`) and the
SearXNG `videos` category. The local SearXNG settings enable the YouTube,
Dailymotion, and Vimeo engines; external instances must enable at least one
video-category engine and JSON output. Saved video metadata is stored in the
separate `aether_saved_videos` ChromaDB collection under
`CHROMA_PERSIST_DIRECTORY`.

The versioned API exposes `POST /api/v1/videos/search`,
`GET /api/v1/videos/saved`, `GET /api/v1/videos/saved/search`,
`POST /api/v1/videos/save`, and `DELETE /api/v1/videos/saved/{video_id}`.

From the repository root on Windows:

```powershell
python -m pip install -e ".\backend[dev]"
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001
```
