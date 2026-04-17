from typing import List, Optional

from sqlalchemy import Boolean, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Staff(Base):
    __tablename__ = "staff"

    __table_args__ = (
        Index("ux_staff_usuario", "usuario", unique=True),
        Index("ux_staff_email", "email", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    usuario: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="repartidor")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    pedidos_asignados: Mapped[List["Pedido"]] = relationship(
        "Pedido",
        back_populates="repartidor",
    )
