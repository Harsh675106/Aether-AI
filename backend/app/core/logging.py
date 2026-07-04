import logging
import sys

import structlog

from app.core.settings import Settings
from app.monitoring.service import MonitoringLogHandler, get_monitoring_service


def configure_logging(settings: Settings) -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
    )

    root_logger = logging.getLogger()
    if not any(isinstance(handler, MonitoringLogHandler) for handler in root_logger.handlers):
        monitoring_handler = MonitoringLogHandler(service=get_monitoring_service())
        monitoring_handler.setFormatter(logging.Formatter("%(message)s"))
        root_logger.addHandler(monitoring_handler)

    root_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)

