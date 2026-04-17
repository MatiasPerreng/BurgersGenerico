import logging
import os
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
from crud import staff as crud_staff
from models import Staff

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

JWT_ALGO = "HS256"
JWT_EXPIRE_HOURS = max(1, min(168, int(os.getenv("JWT_EXPIRE_HOURS", "24"))))


def _resolve_jwt_secret() -> str:
    s = os.getenv("JWT_SECRET_KEY", "").strip()
    if s:
        return s
    env = os.getenv("ENV", "development").lower()
    if env in ("production", "prod"):
        raise RuntimeError(
            "JWT_SECRET_KEY es obligatorio cuando ENV=production (definí un secreto largo y aleatorio)."
        )
    logger.warning(
        "JWT_SECRET_KEY no definido: usando secreto de solo desarrollo. Definí JWT_SECRET_KEY en producción."
    )
    return "cambiar-jwt-secret-en-produccion"


JWT_SECRET = _resolve_jwt_secret()


def create_access_token(staff_id: int, role: str, nombre: str) -> str:
    now_ts = int(time.time())
    exp_ts = now_ts + JWT_EXPIRE_HOURS * 3600
    payload = {
        "sub": str(staff_id),
        "role": role,
        "nombre": nombre,
        "iat": now_ts,
        "exp": exp_ts,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token_payload(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


def get_current_staff(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Staff:
    try:
        payload = decode_token_payload(token)
        sid = int(payload.get("sub", 0))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    staff = crud_staff.obtener_por_id(db, sid)
    if not staff or not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo o inexistente",
        )
    return staff


def require_admin(staff: Staff = Depends(get_current_staff)) -> Staff:
    if staff.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador",
        )
    return staff


def require_repartidor(staff: Staff = Depends(get_current_staff)) -> Staff:
    if staff.role != "repartidor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de repartidor",
        )
    return staff


def warn_insecure_settings() -> None:
    """Llamar desde startup: avisos de seguridad sin tumbar el arranque."""
    env = os.getenv("ENV", "development").lower()
    if env in ("production", "prod"):
        if not os.getenv("MERCADOPAGO_WEBHOOK_SECRET", "").strip():
            logger.warning(
                "MERCADOPAGO_WEBHOOK_SECRET vacío en producción: el webhook MP no exige ?s=... "
                "Configurá un secreto y la misma clave en notification_url."
            )
