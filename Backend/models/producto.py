import decimal
from typing import List, Optional

from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.dialects.mysql import INTEGER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Producto(Base):
    __tablename__ = "producto"

    id_producto: Mapped[int] = mapped_column(INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String(500))
    precio: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False, default="hamburguesa")
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    imagen: Mapped[Optional[str]] = mapped_column(String(255))

    items: Mapped[List["PedidoItem"]] = relationship("PedidoItem", back_populates="producto")
