from typing import List, Optional

from sqlalchemy import case
from sqlalchemy.orm import Session

from models import Producto


def listar_productos_activos(db: Session) -> List[Producto]:
    orden_combo_primero = case((Producto.categoria == "combos", 0), else_=1)
    return (
        db.query(Producto)
        .filter(Producto.activo.is_(True))
        .order_by(orden_combo_primero, Producto.categoria, Producto.nombre)
        .all()
    )


def obtener_producto_por_id(db: Session, id_producto: int) -> Optional[Producto]:
    return db.query(Producto).filter(Producto.id_producto == id_producto).first()
