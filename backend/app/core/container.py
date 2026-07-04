from dataclasses import dataclass

from app.agents.planner import PlaceholderPlanner
from app.chat.service import ChatService
from app.core.settings import Settings
from app.memory.chroma_manager import ChromaMemoryManager
from app.memory.history_store import ConversationHistoryStore
from app.monitoring.service import MonitoringService
from app.web.search import SearXNGClient, WebContentExtractor
from app.plugins.manager import PlaceholderPluginManager
from app.rag.engine import PlaceholderRagEngine
from app.security.audit_logger import AuditLogger
from app.security.encryption_service import EncryptionService
from app.security.permission_manager import PermissionManager
from app.security.secret_manager import SecretManager
from app.services.system_service import SystemService
from app.tools.manager import PlaceholderToolManager
from app.workflow.engine import PlaceholderWorkflowEngine


@dataclass(frozen=True)
class ApplicationContainer:
    settings: Settings

    def system_service(self) -> SystemService:
        return SystemService(settings=self.settings)

    def chat_service(self) -> ChatService:
        return ChatService.from_settings(
            self.settings,
            history_store=self.history_store(),
            memory_manager=self.memory_manager(),
            web_search_client=self.web_search_client(),
            monitoring_service=self.monitoring_service(),
        )

    def planner(self) -> PlaceholderPlanner:
        return PlaceholderPlanner()

    def memory_manager(self) -> ChromaMemoryManager:
        return ChromaMemoryManager(settings=self.settings)

    def history_store(self) -> ConversationHistoryStore:
        return ConversationHistoryStore(self.settings.conversation_history_db)

    def web_search_client(self) -> SearXNGClient:
        return SearXNGClient(self.settings.searxng_base_url)

    def web_content_extractor(self) -> WebContentExtractor:
        return WebContentExtractor()

    def tool_manager(self) -> PlaceholderToolManager:
        return PlaceholderToolManager()

    def workflow_engine(self) -> PlaceholderWorkflowEngine:
        return PlaceholderWorkflowEngine()

    def rag_engine(self) -> PlaceholderRagEngine:
        return PlaceholderRagEngine()

    def monitoring_service(self) -> MonitoringService:
        if not hasattr(self, "_monitoring_service"):
            object.__setattr__(self, "_monitoring_service", MonitoringService())
        return self._monitoring_service

    def plugin_manager(self) -> PlaceholderPluginManager:
        return PlaceholderPluginManager()

    def permission_manager(self) -> PermissionManager:
        return PermissionManager()

    def secret_manager(self) -> SecretManager:
        return SecretManager(settings=self.settings)

    def audit_logger(self) -> AuditLogger:
        return AuditLogger()

    def encryption_service(self) -> EncryptionService:
        return EncryptionService()

