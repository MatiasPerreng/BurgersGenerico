import datetime
import decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .cliente import ClienteCreate

MedioPago = Literal["efectivo", "debito", "mercadopago"]

ALLOWED_COMPROBANTE_EXT = frozenset({".jpg", ".jpeg", ".png", ".webp", ".pdf"})
MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024


class PedidoItemIn(BaseModel):
    id_producto: int = Field(..., ge=1)
    cantidad: int = Field(..., ge=1, le=99)


class TelefonoSeguimientoIn(BaseModel):
    """Consulta pública de pedidos asociados al teléfono (mismo criterio que al hacer el pedido)."""

    telefono: str = Field(..., min_length=1, max_length=40)

    @field_validator("telefono")
    @classmethod
    def strip_telefono(cls, v: str) -> str:
        return (v or "").strip()


class PedidoCrearIn(BaseModel):
    cliente: ClienteCreate
    direccion: str = Field(..., min_length=5, max_length=255)
    referencia: Optional[str] = Field(None, max_length=255)
    notas: Optional[str] = Field(None, max_length=500)
    items: List[PedidoItemIn] = Field(..., min_length=1)
    medio_pago: MedioPago = "efectivo"
    mercadopago_referencia: Optional[str] = Field(None, max_length=128)
    efectivo_necesita_cambio: bool = Field(
        False,
        description="Solo efectivo: el cliente necesita vuelto.",
    )
    efectivo_pago_con: Optional[decimal.Decimal] = Field(
        None,
        ge=0,
        description="Solo efectivo si necesita cambio: monto con el que paga (debe ser ≥ total del pedido).",
    )


class PedidoItemOut(BaseModel):
    id_producto: int
    nombre_producto: str
    cantidad: int
    precio_unitario: decimal.Decimal
    subtotal: decimal.Decimal

    class Config:
        from_attributes = True


EstadoPedido = Literal[
    "PENDIENTE_CONFIRMACION_MP",
    "PENDIENTE",
    "EN_PREPARACION",
    "LISTO",
    "EN_CAMINO",
    "ENTREGADO",
    "CANCELADO",
]


class PedidoEstadoPatch(BaseModel):
    estado: EstadoPedido
    """Obligatorio si estado es EN_CAMINO: repartidor asignado."""
    id_repartidor: Optional[int] = Field(None, ge=1)

    @model_validator(mode="after")
    def validar_repartidor_en_camino(self):
        if self.estado == "EN_CAMINO" and not self.id_repartidor:
            raise ValueError("Asigná un repartidor para poner el pedido en la calle.")
        return self


class MercadoPagoSyncIn(BaseModel):
    """Sincronizar estado del pedido tras el pago (retorno desde Checkout Pro o webhook)."""

    payment_id: Optional[str] = Field(
        None,
        max_length=64,
        description="ID del pago en MP (query o webhook). Opcional si mandás external_reference.",
    )
    external_reference: Optional[str] = Field(
        None,
        max_length=32,
        description="Copia de la URL de retorno de MP; respaldo si GET /payments no trae external_reference.",
    )
    preference_id: Optional[str] = Field(
        None,
        max_length=64,
        description="ID de preferencia en la URL de retorno; respaldo para resolver id_pedido.",
    )

    @field_validator("payment_id", "external_reference", "preference_id", mode="before")
    @classmethod
    def vacio_a_none(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    @model_validator(mode="after")
    def al_menos_un_identificador(self):
        if not self.payment_id and not self.external_reference and not self.preference_id:
            raise ValueError("Enviá payment_id, external_reference o preference_id.")
        return self


class MercadoPagoAsociarLinkIn(BaseModel):
    """Asociar un pago hecho por link de cobro (sin external_reference) al pedido del token."""

    token_seguimiento: str = Field(..., min_length=8, max_length=48)
    payment_id: str = Field(
        ...,
        min_length=1,
        max_length=80,
        description="N° de operación / payment_id (solo dígitos o texto con el número).",
    )


class PedidoOut(BaseModel):
    id_pedido: int
    token_seguimiento: str
    estado: str
    total: decimal.Decimal
    direccion: str
    referencia: Optional[str] = None
    notas: Optional[str] = None
    medio_pago: str = "efectivo"
    mercadopago_referencia: Optional[str] = None
    mercadopago_payment_id: Optional[str] = Field(
        None,
        description="ID del pago en la API de Mercado Pago (Checkout Pro, webhook o sincronizar).",
    )
    mercadopago_receipt_url: Optional[str] = Field(
        None,
        description="URL del comprobante en Mercado Pago (si la API lo devuelve).",
    )
    mercadopago_seller_activity_url: Optional[str] = Field(
        None,
        description="URL Actividades (detalle del cobro para el vendedor), si se obtuvo al sincronizar el pago.",
    )
    mercadopago_init_point: Optional[str] = Field(
        None,
        description="URL de Checkout Pro cuando el backend generó la preferencia al crear el pedido.",
    )
    mercadopago_preference_id: Optional[str] = Field(
        None,
        description="ID de la preferencia MP (opcional, depuración).",
    )
    comprobante_adjunto: bool = False
    comprobante_nombre: Optional[str] = Field(
        None, description="Nombre del archivo servido en /media/comprobantes/ (p. ej. admin)."
    )
    id_repartidor: Optional[int] = None
    repartidor_nombre: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    cliente_nombre: str
    cliente_apellido: str
    cliente_telefono: str
    items: List[PedidoItemOut]
    efectivo_necesita_cambio: bool = False
    efectivo_pago_con: Optional[decimal.Decimal] = Field(
        None,
        description="Si pagás en efectivo y necesitás cambio: monto con el que pagás (≥ total).",
    )

    class Config:
        from_attributes = True
