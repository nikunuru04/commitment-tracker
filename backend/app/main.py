from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .migrations import migrate
from .routers import (
    auth,
    categories,
    commitments,
    incomes,
    savings,
    summary,
    transactions,
)
from .routers import settings as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Commitment Tracker", version="1.0.0", lifespan=lifespan)
    origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for r in (
        auth.router,
        categories.router,
        incomes.router,
        commitments.router,
        transactions.router,
        savings.goals_router,
        savings.allocations_router,
        settings_router.router,
        summary.router,
    ):
        app.include_router(r)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": "1.0.0"}

    static_dir = Path(settings.STATIC_DIR) if settings.STATIC_DIR else None
    if static_dir and static_dir.exists():

        # Registered BEFORE any mount: serves real files, SPA fallback for
        # client routes, JSON 404 for unknown /api paths.
        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str):
            if full_path == "api" or full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not Found")
            candidate = static_dir / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(static_dir / "index.html")

    return app


app = create_app()
