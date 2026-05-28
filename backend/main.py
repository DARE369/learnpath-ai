from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from config import settings

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT} | Debug: {settings.DEBUG}")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered personalized learning platform",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    logger.info(f"{request.method} {request.url.path} → {response.status_code}")
    return response


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["system"])
async def root():
    return {
        "message": "LearnPath AI API",
        "docs": "/docs",
        "version": settings.APP_VERSION,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An error occurred",
        },
    )


# Stage 1: Core pipeline routers
from routers import youtube, eqs, summary, concept_graph, path, cache
app.include_router(youtube.router, prefix="/api/youtube", tags=["youtube"])
app.include_router(eqs.router, prefix="/api/eqs", tags=["eqs"])
app.include_router(summary.router, prefix="/api/summary", tags=["summary"])
app.include_router(concept_graph.router, prefix="/api/concepts", tags=["concepts"])
app.include_router(path.router, prefix="/api/path", tags=["path"])
app.include_router(cache.router, prefix="/api/cache", tags=["cache"])

# Wire up search orchestration service (uses all Stage 1 singletons)
import services.search_service as _search_mod
from services.youtube_service import youtube_service
from services.eqs_service import EQSService
from services.summary_service import SummaryService
from services.concept_graph_service import concept_graph_service
from services.path_service import path_service
from services.cache_service import cache_service

_search_mod.search_service = _search_mod.SearchService(
    youtube_service=youtube_service,
    eqs_service=EQSService(),
    summary_service=SummaryService(),
    concept_graph_service=concept_graph_service,
    path_service=path_service,
    cache_service=cache_service,
)

# Stage 2: User layer routers
from routers import auth, session
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(session.router, prefix="/api/sessions", tags=["sessions"])

# Future routers (uncommented as each stage is implemented)
# from routers import search, progress
# app.include_router(search.router, prefix="/api/search", tags=["search"])
# app.include_router(progress.router, prefix="/api/progress", tags=["progress"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
