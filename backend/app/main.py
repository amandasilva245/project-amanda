from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1.router import api_router

# Import all models so Alembic / create_all can discover them
import app.models  # noqa: F401

# Setup logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic in production)
    if settings.ENVIRONMENT == "development":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Theatrical ERP — Production, Cast, Finance & Audience Management",
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# ─── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ─── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log validation errors for debugging."""
    body = await request.body()
    logger.error(f"Validation error on {request.url.path}")
    logger.error(f"Request body: {body.decode() if body else 'empty'}")
    logger.error(f"Validation errors: {exc.errors()}")
    
    # Convert error details to JSON-serializable format
    errors = []
    for error in exc.errors():
        error_dict = {
            "loc": list(error.get("loc", [])),
            "msg": error.get("msg", ""),
            "type": error.get("type", "")
        }
        if "ctx" in error:
            # Convert context objects to strings
            ctx = error["ctx"]
            if isinstance(ctx, dict):
                error_dict["ctx"] = {k: str(v) for k, v in ctx.items()}
            else:
                error_dict["ctx"] = str(ctx)
        errors.append(error_dict)
    
    return JSONResponse(
        status_code=422,
        content={"detail": errors}
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
