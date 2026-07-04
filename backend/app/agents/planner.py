from collections.abc import Sequence

from app.core.interfaces import Planner


class PlaceholderPlanner(Planner):
    async def create_plan(self, objective: str) -> Sequence[str]:
        return [f"Plan placeholder for objective: {objective}"]

