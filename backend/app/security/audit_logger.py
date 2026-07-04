from collections.abc import Mapping
from typing import Any

from app.core.logging import get_logger


class AuditLogger:
    async def record(self, actor: str, action: str, metadata: Mapping[str, Any] | None = None) -> None:
        logger = get_logger("aether.audit")
        await logger.ainfo("audit_event", actor=actor, action=action, metadata=dict(metadata or {}))

