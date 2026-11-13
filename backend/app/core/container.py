from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.agents.planner import PlaceholderPlanner
from app.chat.service import ChatService
from app.core.settings import Settings
from app.images.history_store import ImageHistoryStore
from app.images.service import ImageSearchService, SearXNGImageSearchProvider
from app.memory.chroma_manager import ChromaMemoryManager
from app.memory.history_store import ConversationHistoryStore
from app.monitoring.service import MonitoringService, get_monitoring_service
from app.plugins.manager import PlaceholderPluginManager
from app.rag.engine import PlaceholderRagEngine
from app.security.audit_logger import AuditLogger
from app.security.encryption_service import EncryptionService
from app.security.permission_manager import PermissionManager
from app.security.secret_manager import SecretManager
from app.services.system_service import SystemService
from app.tools.manager import PlaceholderToolManager
from app.web.search import SearXNGClient, WebContentExtractor
from app.workflow.engine import PlaceholderWorkflowEngine
from app.browser.service import BrowserService
from app.videos.command_router import VideoCommandRouter
from app.videos.service import SearXNGVideoSearchService
from app.videos.storage import SavedVideoStore



@dataclass
class ApplicationContainer:
    settings: Settings
    _monitoring_service: MonitoringService = field(default_factory=get_monitoring_service, init=False)

    def system_service(self) -> SystemService:
        return SystemService(settings=self.settings)

    def voice_service(self) -> Any:
        from app.voice.service import VoiceService
        return VoiceService.get_instance(self.settings)

    def chat_service(self) -> ChatService:
        return ChatService.from_settings(
            self.settings,
            history_store=self.history_store(),
            memory_manager=self.memory_manager(),
            web_search_client=self.web_search_client(),
            monitoring_service=self.monitoring_service(),
            image_search_service=self.image_search_service(),
            planner=self.planner(),
            tool_manager=self.tool_manager(),
            browser_service=self.browser_service(),
            youtube_command_router=self.youtube_command_router(),
            video_command_router=self.video_command_router(),
        )


    def planner(self) -> PlaceholderPlanner:
        from app.llm.ollama_provider import OllamaProvider
        return PlaceholderPlanner(
            settings=self.settings,
            llm_provider=OllamaProvider(self.settings),
        )


    def memory_manager(self) -> ChromaMemoryManager:
        return ChromaMemoryManager(settings=self.settings)

    def database_engine(self) -> AsyncEngine:
        from app.database.session import create_engine
        return create_engine(self.settings)

    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        from app.database.session import create_session_factory
        return create_session_factory(self.database_engine())

    def history_store(self) -> ConversationHistoryStore:
        return ConversationHistoryStore(self.session_factory())

    def web_search_client(self) -> SearXNGClient:
        return SearXNGClient(self.settings.searxng_base_url)

    def web_content_extractor(self) -> WebContentExtractor:
        return WebContentExtractor()

    def image_history_store(self) -> ImageHistoryStore:
        return ImageHistoryStore(settings=self.settings)

    def image_search_service(self) -> ImageSearchService:
        return ImageSearchService(
            provider=SearXNGImageSearchProvider(self.settings.searxng_base_url),
            monitoring_service=self.monitoring_service(),
            history_store=self.image_history_store(),
        )

    def saved_video_store(self) -> SavedVideoStore:
        if not hasattr(self, "_saved_video_store"):
            self._saved_video_store = SavedVideoStore(settings=self.settings)
        return self._saved_video_store

    def video_search_service(self) -> SearXNGVideoSearchService:
        return SearXNGVideoSearchService(self.settings.searxng_base_url)

    def video_command_router(self) -> VideoCommandRouter:
        if not hasattr(self, "_video_command_router"):
            self._video_command_router = VideoCommandRouter(
                self.video_search_service(),
                self.saved_video_store(),
                self.browser_manager(),
            )
        return self._video_command_router

    def tool_manager(self) -> PlaceholderToolManager:
        return PlaceholderToolManager()

    def workflow_engine(self) -> PlaceholderWorkflowEngine:
        return PlaceholderWorkflowEngine()

    def rag_engine(self) -> PlaceholderRagEngine:
        return PlaceholderRagEngine()

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

    def monitoring_service(self) -> MonitoringService:
        return self._monitoring_service

    def screenshot_store(self) -> Any:
        if not hasattr(self, "_screenshot_store"):
            from app.browser.screenshot_store import ScreenshotStore
            self._screenshot_store = ScreenshotStore(settings=self.settings)
        return self._screenshot_store

    def browser_manager(self) -> Any:
        if not hasattr(self, "_browser_manager"):
            from app.browser.browser_manager import BrowserManager
            self._browser_manager = BrowserManager.get_instance(
                settings=self.settings,
                monitoring_service=self.monitoring_service(),
                screenshot_store=self.screenshot_store(),
            )
        return self._browser_manager

    def browser_service(self) -> Any:
        return self.browser_manager()

    def youtube_command_router(self) -> Any:
        if not hasattr(self, "_youtube_command_router"):
            from app.youtube.youtube_command_router import YouTubeCommandRouter
            from app.youtube.youtube_manager import YouTubeManager

            self._youtube_command_router = YouTubeCommandRouter(
                YouTubeManager(self.browser_manager())
            )
        return self._youtube_command_router

    def browser_controller(self) -> Any:
        return self.browser_manager().controller

