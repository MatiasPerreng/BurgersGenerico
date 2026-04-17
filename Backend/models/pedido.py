import datetime
import decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, ForeignKey, Numeric, String, TIMESTAMP, text
from sqlalchemy.dialects.mysql import INTEGER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .staff import Staff


class Pedido(Base):
    __tablename__ = "pedido"

    id_pedido: Mapped[int] = mapped_column(INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    id_cliente: Mapped[int] = mapped_column(
        INTEGER(unsigned=True),
        ForeignKey("cliente.id_cliente"),
        nullable=False,
    )
    id_repartidor: Mapped[Optional[int]] = mapped_column(
        INTEGER(unsigned=True),
        ForeignKey("staff.id"),
        nullable=True,
    )
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDIENTE")
    total: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    direccion: Mapped[str] = mapped_column(String(255), nullable=False)
    referencia: Mapped[Optional[str]] = mapped_column(String(255))
    notas: Mapped[Optional[str]] = mapped_column(String(500))
    medio_pago: Mapped[str] = mapped_column(String(32), nullable=False, default="efectivo")
    efectivo_necesita_cambio: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    efectivo_pago_con: Mapped[Optional[decimal.Decimal]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Monto con el que paga (>= total) si necesita cambio",
    )
    mercadopago_referencia: Mapped[Optional[str]] = mapped_column(String(128))
    mercadopago_payment_id: Mapped[Optional[str]] = mapped_column(String(64))
    mercadopago_receipt_url: Mapped[Optional[str]] = mapped_column(String(512))
    mercadopago_seller_activity_url: Mapped[Optional[str]] = mapped_column(
        String(512),
        comment="URL Actividades MP (detalle cobro vendedor), desde JSON del pago al sincronizar",
    )
    comprobante_archivo: Mapped[Optional[str]] = mapped_column(String(255))
    token_seguimiento: Mapped[str] = mapped_column(String(43), unique=True, nullable=False)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="pedidos")
    repartidor: Mapped[Optional["Staff"]] = relationship(
        "Staff",
        back_populates="pedidos_asignados",
        foreign_keys=[id_repartidor],
    )
    items: Mapped[List["PedidoItem"]] = relationship(
        "PedidoItem",
        back_populates="pedido",
        cascade="all, delete-orphan",
    )
