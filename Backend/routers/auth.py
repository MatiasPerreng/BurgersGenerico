from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crud import staff as crud_staff
from database import get_db
from deps.auth import create_access_token
from schemas import LoginIn, TokenOut
from utils.passwords import verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    staff = crud_staff.obtener_por_usuario(db, body.usuario)
    if not staff or not verify_password(body.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )
    if not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )
    token = create_access_token(staff.id, staff.role, staff.nombre)
    return TokenOut(access_token=token, role=staff.role, nombre=staff.nombre)
