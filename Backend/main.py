import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)

from deps.auth import warn_insecure_settings
from routers import admin, auth, pedidos, productos, repartidor

logger = logging.getLogger("uvicorn.error")

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="API Smash Burgers",
    version="1.1.0",
    description="Pedidos web para hamburguesería smash.",
)

STATIC_DIR = BASE_DIR / "static"
(STATIC_DIR / "productos").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "comprobantes").mkdir(parents=True, exist_ok=True)

app.mount(
    "/media/productos",
    StaticFiles(directory=str(STATIC_DIR / "productos")),
    name="media-productos",
)

app.mount(
    "/media/comprobantes",
    StaticFiles(directory=str(STATIC_DIR / "comprobantes")),
    name="media-comprobantes",
)

_default_cors = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5175,http://127.0.0.1:5175,"
    "http://localhost:4173,http://127.0.0.1:4173,"
    "http://localhost:4174,http://127.0.0.1:4174"
)
_cors_raw = os.getenv("CORS_ORIGINS", _default_cors)
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
_cors_regex_raw = os.getenv("CORS_ORIGIN_REGEX", "").strip()
_cors_origin_regex = _cors_regex_raw if _cors_regex_raw else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(productos.router)
app.include_router(pedidos.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(repartidor.router)


@app.on_event("startup")
async def startup_event():
    warn_insecure_settings()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    logger.exception("Error no manejado: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor."},
    )


@app.get("/")
def health():
    return {"status": "ok", "app": "smash-burgers"}
