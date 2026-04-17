import decimal
from typing import Optional

from pydantic import BaseModel


class ProductoOut(BaseModel):
    id_producto: int
    nombre: str
    descripcion: Optional[str] = None
    precio: decimal.Decimal
    categoria: str
    activo: bool
    imagen: Optional[str] = None

    class Config:
        from_attributes = True
