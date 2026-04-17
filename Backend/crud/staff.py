from typing import List, Optional

from sqlalchemy.orm import Session

from models import Staff


def obtener_por_usuario(db: Session, usuario: str) -> Optional[Staff]:
    if not usuario or not usuario.strip():
        return None
    return (
        db.query(Staff)
        .filter(Staff.usuario == usuario.strip())
        .first()
    )


def obtener_por_id(db: Session, staff_id: int) -> Optional[Staff]:
    return db.query(Staff).filter(Staff.id == staff_id).first()


def listar_repartidores_activos(db: Session) -> List[Staff]:
    return (
        db.query(Staff)
        .filter(Staff.role == "repartidor", Staff.is_active.is_(True))
        .order_by(Staff.nombre.asc())
        .all()
    )
