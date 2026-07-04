from app.core.interfaces import WorkflowEngine


class PlaceholderWorkflowEngine(WorkflowEngine):
    async def describe(self) -> str:
        return "Workflow engine interface initialized."

