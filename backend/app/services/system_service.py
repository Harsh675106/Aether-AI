import asyncio
import platform
import socket
import time
from dataclasses import dataclass
from typing import Any

import psutil

from app.core.settings import Settings
from app.schemas.system import SystemSnapshot


@dataclass(frozen=True)
class SystemService:
    settings: Settings

    async def snapshot(self) -> SystemSnapshot:
        cpu_percent, memory, disk, boot_time = await self._read_metrics()
        return SystemSnapshot(
            environment=self.settings.environment,
            model=self.settings.llm_model,
            memory=f'{memory.percent:.1f}% used',
            database="configured",
            vision="disabled",
            internet="restricted",
            tools="idle",
            cpu_percent=round(cpu_percent, 1),
            cpu_cores=psutil.cpu_count(logical=True) or 0,
            ram_percent=round(memory.percent, 1),
            ram_used_bytes=memory.used,
            ram_total_bytes=memory.total,
            disk_percent=round(disk.percent, 1),
            disk_used_bytes=disk.used,
            disk_total_bytes=disk.total,
            uptime_seconds=max(0.0, time.time() - boot_time),
            hostname=socket.gethostname(),
            platform=f'{platform.system()} {platform.release()}',
            gpu=None,
        )

    async def _read_metrics(self) -> tuple[float, Any, Any, float]:
        return await asyncio.to_thread(self._read_metrics_sync)

    def _read_metrics_sync(self) -> tuple[float, Any, Any, float]:
        return (
            psutil.cpu_percent(interval=0.1),
            psutil.virtual_memory(),
            psutil.disk_usage('/'),
            psutil.boot_time(),
        )
