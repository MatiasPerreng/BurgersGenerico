import decimal

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.mysql import INTEGER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class PedidoItem(Base):
    __tablename__ = "pedido_item"

    id_item: Mapped[int] = mapped_column(INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    id_pedido: Mapped[int] = mapped_column(
        INTEGER(unsigned=True),
        ForeignKey("pedido.id_pedido", ondelete="CASCADE"),
        nullable=False,
    )
    id_producto: Mapped[int] = mapped_column(
        INTEGER(unsigned=True),
        ForeignKey("producto.id_producto"),
        nullable=False,
    )
    cantidad: Mapped[int] = mapped_column(INTEGER(unsigned=True), nullable=False)
    precio_unitario: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    pedido: Mapped["Pedido"] = relationship("Pedido", back_populates="items")
    producto: Mapped["Producto"] = relationship("Producto", back_populates="items")
