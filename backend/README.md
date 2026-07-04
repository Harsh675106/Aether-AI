# Backend

FastAPI backend foundation for Aether AI using Python 3.13, Pydantic v2, SQLAlchemy async, Alembic, structured logging, and clean architecture boundaries.

## Structure

- `app/api/` - HTTP routers and versioned API surface.
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

