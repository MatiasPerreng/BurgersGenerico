import decimal
import logging
import secrets
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

from fastapi import HTTPException, status

ESTADOS_PEDIDO = frozenset(
    {
        "PENDIENTE_CONFIRMACION_MP",
        "PENDIENTE",
        "EN_PREPARACION",
        "LISTO",
        "EN_CAMINO",
        "ENTREGADO",
        "CANCELADO",
    }
)
from sqlalchemy import asc
from sqlalchemy.orm import Session, joinedload

from crud import cliente as crud_cliente
from crud import producto as crud_producto
from models import Cliente, Pedido, PedidoItem, Staff
from schemas import MercadoPagoSyncIn, PedidoCrearIn, PedidoItemOut, PedidoOut
from schemas.pedido import ALLOWED_COMPROBANTE_EXT, MAX_COMPROBANTE_BYTES

logger = logging.getLogger(__name__)

COMPROBANTES_DIR = Path(__file__).resolve().parent.parent / "static" / "comprobantes"


def _lanzar_si_falta_estado_mp_en_mysql(exc: Exception) -> None:
    """
    ENUM antiguo sin PENDIENTE_CONFIRMACION_MP → MySQL devuelve 1265/1366/truncated.
    El mensaje no siempre incluye la palabra 'estado', por eso el chequeo es amplio.
    """
    orig = getattr(exc, "orig", None)
    texto = f"{exc} {orig or ''}".lower()
    sospecha_enum = any(
        s in texto
        for s in (
            "truncated",
            "1265",
            "1366",
            "incorrect",
            "data truncated",
            "pendiente_confirmacion",
        )
    )
    if not sospecha_enum:
        return
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Hay que actualizar la columna `pedido.estado` en MySQL. Opciones: "
            "(1) Ejecutá `Database/add_estado_pendiente_confirmacion_mp.sql`, o "
            "(2) `ALTER TABLE pedido MODIFY COLUMN estado VARCHAR(32) NOT NULL DEFAULT \"PENDIENTE\";` "
            "y reiniciá el backend."
        ),
    ) from exc


def _canonical_telefono_uy_digitos(d: str) -> str:
    """
    Móvil Uruguay comparable: 09xxxxxxxx (9 dígitos).
    - +598 / 598 + nacional: se quita 598.
    - Formato internacional sin 0 (5989xxxxxxx): tras quitar 598 quedan 8 dígitos 9… → se antepone 0.
    """
    if not d:
        return ""
    if d.startswith("598") and len(d) >= 11:
        d = d[3:]
    if len(d) == 8 and d[0] == "9":
        d = "0" + d
    return d


def normalizar_telefono(valor: str) -> str:
    """Dígitos en forma nacional UY (09xxxxxxxx) para comparar con lo guardado en cliente."""
    raw = "".join(c for c in (valor or "") if c.isdigit())
    return _canonical_telefono_uy_digitos(raw)


def _variantes_digitos_telefono_uy(norm: str) -> List[str]:
    """
    Mismas variantes que suelen guardarse en texto: 095064060, 95064060, 598095064060, 59895064060.
    """
    if not norm:
        return []
    out = {norm}
    if len(norm) == 9 and norm.startswith("0"):
        out.add(norm[1:])
        out.add("598" + norm)
        out.add("598" + norm[1:])
    return list(out)


def _opciones_carga_pedido():
    return (
        joinedload(Pedido.cliente),
        joinedload(Pedido.repartidor),
        joinedload(Pedido.items).joinedload(PedidoItem.producto),
    )


def pedido_a_respuesta(pedido: Pedido) -> PedidoOut:
    if not pedido.cliente:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Inconsistencia interna: pedido sin cliente.",
        )
    items_out: List[PedidoItemOut] = []
    for it in pedido.items:
        p = it.producto
        if not p:
            continue
        subtotal = (decimal.Decimal(it.precio_unitario) * it.cantidad).quantize(
            decimal.Decimal("0.01")
        )
        items_out.append(
            PedidoItemOut(
                id_producto=p.id_producto,
                nombre_producto=p.nombre,
                cantidad=it.cantidad,
                precio_unitario=decimal.Decimal(it.precio_unitario),
                subtotal=subtotal,
            )
        )
    c = pedido.cliente
    mp_ref = getattr(pedido, "mercadopago_referencia", None)
    mp_pay_id = getattr(pedido, "mercadopago_payment_id", None)
    mp_rec_url = getattr(pedido, "mercadopago_receipt_url", None)
    mp_seller_url = getattr(pedido, "mercadopago_seller_activity_url", None)
    medio = getattr(pedido, "medio_pago", None) or "efectivo"
    comp_path = getattr(pedido, "comprobante_archivo", None)
    rep = getattr(pedido, "repartidor", None)
    id_rep = getattr(pedido, "id_repartidor", None)
    return PedidoOut(
        id_pedido=pedido.id_pedido,
        token_seguimiento=pedido.token_seguimiento,
        estado=pedido.estado,
        total=pedido.total,
        direccion=pedido.direccion,
        referencia=pedido.referencia,
        notas=pedido.notas,
        medio_pago=medio,
        mercadopago_referencia=mp_ref if medio == "mercadopago" else None,
        mercadopago_payment_id=mp_pay_id if medio == "mercadopago" else None,
        mercadopago_receipt_url=mp_rec_url if medio == "mercadopago" else None,
        mercadopago_seller_activity_url=mp_seller_url if medio == "mercadopago" else None,
        comprobante_adjunto=bool(comp_path),
        comprobante_nombre=comp_path if comp_path else None,
        id_repartidor=id_rep,
        repartidor_nombre=rep.nombre if rep else None,
        created_at=pedido.created_at,
        cliente_nombre=c.nombre,
        cliente_apellido=c.apellido,
        cliente_telefono=c.telefono,
        items=items_out,
        efectivo_necesita_cambio=bool(getattr(pedido, "efectivo_necesita_cambio", False)),
        efectivo_pago_con=getattr(pedido, "efectivo_pago_con", None),
    )


def _guardar_comprobante(id_pedido: int, data: bytes, ext: str) -> str:
    COMPROBANTES_DIR.mkdir(parents=True, exist_ok=True)
    nombre = f"pedido_{id_pedido}_{uuid.uuid4().hex}{ext}"
    ruta = COMPROBANTES_DIR / nombre
    ruta.write_bytes(data)
    return nombre


def crear_pedido_web(
    db: Session,
    payload: PedidoCrearIn,
    comprobante: Optional[Tuple[bytes, str]] = None,
) -> PedidoOut:
    cliente = crud_cliente.obtener_o_crear_cliente(db, payload.cliente)

    total = decimal.Decimal("0.00")
    productos_cache: Dict[int, tuple] = {}

    for linea in payload.items:
        producto = crud_producto.obtener_producto_por_id(db, linea.id_producto)
        if not producto or not producto.activo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Producto inválido o inactivo: {linea.id_producto}",
            )
        precio = decimal.Decimal(producto.precio)
        subtotal = (precio * linea.cantidad).quantize(decimal.Decimal("0.01"))
        total += subtotal
        productos_cache[linea.id_producto] = (producto, precio)

    mp_ref = None
    if payload.medio_pago == "mercadopago" and payload.mercadopago_referencia:
        mp_ref = payload.mercadopago_referencia.strip()[:128] or None

    ef_necesita = False
    ef_pago_con = None
    if payload.medio_pago == "efectivo":
        ef_necesita = bool(payload.efectivo_necesita_cambio)
        if ef_necesita:
            if payload.efectivo_pago_con is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Indicá con cuánto pagás en efectivo para preparar el cambio.",
                )
            pc = decimal.Decimal(str(payload.efectivo_pago_con)).quantize(decimal.Decimal("0.01"))
            if pc < total:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El monto con el que pagás debe ser mayor o igual al total del pedido.",
                )
            ef_pago_con = pc

    estado_inicial = (
        "PENDIENTE_CONFIRMACION_MP" if payload.medio_pago == "mercadopago" else "PENDIENTE"
    )
    pedido = Pedido(
        id_cliente=cliente.id_cliente,
        estado=estado_inicial,
        total=total,
        direccion=payload.direccion.strip(),
        referencia=payload.referencia.strip() if payload.referencia else None,
        notas=payload.notas.strip() if payload.notas else None,
        medio_pago=payload.medio_pago,
        efectivo_necesita_cambio=ef_necesita,
        efectivo_pago_con=ef_pago_con,
        mercadopago_referencia=mp_ref,
        token_seguimiento=secrets.token_urlsafe(16),
    )
    db.add(pedido)
    try:
        db.flush()
    except Exception as e:
        db.rollback()
        if payload.medio_pago == "mercadopago":
            _lanzar_si_falta_estado_mp_en_mysql(e)
        raise

    if comprobante:
        data, ext = comprobante
        if payload.medio_pago != "mercadopago":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El comprobante solo aplica si elegís Mercado Pago.",
            )
        if ext.lower() not in ALLOWED_COMPROBANTE_EXT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de comprobante no permitido (JPG, PNG, WebP o PDF).",
            )
        if len(data) > MAX_COMPROBANTE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo supera 5 MB.",
            )
        pedido.comprobante_archivo = _guardar_comprobante(pedido.id_pedido, data, ext.lower())
        db.add(pedido)

    for linea in payload.items:
        producto, precio = productos_cache[linea.id_producto]
        db.add(
            PedidoItem(
                id_pedido=pedido.id_pedido,
                id_producto=producto.id_producto,
                cantidad=linea.cantidad,
                precio_unitario=precio,
            )
        )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        if payload.medio_pago == "mercadopago":
            _lanzar_si_falta_estado_mp_en_mysql(e)
        raise

    pedido_cargado = (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.id_pedido == pedido.id_pedido)
        .first()
    )
    if not pedido_cargado:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo recargar el pedido tras crearlo.",
        )
    out = pedido_a_respuesta(pedido_cargado)

    # Mercado Pago: Checkout Pro primero (external_reference = id_pedido → el pago queda asociado al
    # volver con payment_id, sin que el cliente cargue el n°). Si no hay token o falla la preferencia,
    # se usa el link de cobro como respaldo (asociación manual en Seguimiento o admin).
    try:
        from utils import mercadopago_api as mp_api

        manual_ref = payload.mercadopago_referencia and payload.mercadopago_referencia.strip()
        if payload.medio_pago == "mercadopago" and not comprobante and not manual_ref:
            init_point: Optional[str] = None
            pref_id: Optional[str] = None
            if mp_api.mp_token_configurado():
                titulo = f"Pedido #{pedido_cargado.id_pedido} — La Buena Vida"
                email = getattr(cliente, "email", None)
                init_point, pref_id, err = mp_api.crear_preferencia_checkout_pro(
                    pedido_cargado.id_pedido,
                    pedido_cargado.total,
                    titulo,
                    email,
                )
                if err:
                    logger.info("Checkout MP no generado: %s", err)
                    init_point = None
            if not init_point:
                link_base = mp_api.url_link_pago_negocio()
                if link_base:
                    init_point = mp_api.url_link_pago_con_pedido(pedido_cargado.id_pedido)
                    pref_id = None
            if init_point:
                out = out.model_copy(
                    update={
                        "mercadopago_init_point": init_point,
                        "mercadopago_preference_id": pref_id,
                    }
                )
    except Exception as e:
        logger.warning("Checkout MP / link pago: %s", e)

    return out


def _parse_id_pedido_ref(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return int(decimal.Decimal(s))
    except (decimal.InvalidOperation, ValueError, TypeError):
        try:
            return int(float(s))
        except (ValueError, TypeError):
            return None


def _monto_transaccion_mp(pay: dict) -> Optional[decimal.Decimal]:
    for key in ("transaction_amount", "total_paid_amount", "net_amount", "transaction_net_received_amount"):
        v = pay.get(key)
        if v is None:
            continue
        try:
            return decimal.Decimal(str(v)).quantize(decimal.Decimal("0.01"))
        except (decimal.InvalidOperation, ValueError, TypeError):
            continue
    td = pay.get("transaction_details")
    if isinstance(td, dict):
        for key in ("net_received_amount", "total_paid_amount", "installment_amount"):
            v = td.get(key)
            if v is None:
                continue
            try:
                return decimal.Decimal(str(v)).quantize(decimal.Decimal("0.01"))
            except (decimal.InvalidOperation, ValueError, TypeError):
                continue
    return None


def _pago_mercadopago_coincide_con_pedido(pedido: Pedido, pay: dict) -> bool:
    """Evita asociar un pago de otro monto/moneda al pedido."""
    currency = (pay.get("currency_id") or "").strip().upper()
    if currency and currency != "UYU":
        logger.warning(
            "MP moneda != UYU (pedido %s): %s",
            pedido.id_pedido,
            currency,
        )
        return False

    st = (pay.get("status") or "").lower()
    pay_dec = _monto_transaccion_mp(pay)

    if pay_dec is None:
        if st in ("approved", "pending", "in_process", "in_mediation"):
            logger.info(
                "MP: sin monto en JSON; se acepta por status=%s pedido=%s payment_id=%s",
                st,
                pedido.id_pedido,
                pay.get("id"),
            )
            return True
        logger.warning(
            "MP sin monto usable (pedido %s) keys=%s",
            pedido.id_pedido,
            list(pay.keys())[:25],
        )
        return False
    total = pedido.total
    total_q = (
        total.quantize(decimal.Decimal("0.01"))
        if hasattr(total, "quantize")
        else decimal.Decimal(str(total)).quantize(decimal.Decimal("0.01"))
    )
    diff = abs(pay_dec - total_q)
    if pay_dec != total_q and diff > decimal.Decimal("0.02"):
        logger.warning(
            "MP monto no coincide con pedido %s: MP=%s esperado=%s (status=%s)",
            pedido.id_pedido,
            pay_dec,
            total_q,
            pay.get("status"),
        )
        return False
    return True


def _mysql_columna_mp_opcional_falta(exc: Exception) -> bool:
    """p. ej. columna mercadopago_seller_activity_url no migrada → 1054 / unknown column."""
    texto = f"{exc} {getattr(exc, 'orig', '')}".lower()
    if "mercadopago_seller_activity_url" in texto:
        return True
    return "1054" in texto and "unknown column" in texto


def _commit_pedido_tras_volcar_mp(db: Session, pedido: Pedido, pay: dict) -> None:
    """
    Persiste cambios del volcado MP. Si MySQL no tiene la columna de URL Actividades,
    reintenta sin guardar esa URL para no bloquear mercadopago_payment_id.
    """
    id_pedido = pedido.id_pedido
    try:
        db.add(pedido)
        db.commit()
    except (OperationalError, ProgrammingError) as e:
        db.rollback()
        if not _mysql_columna_mp_opcional_falta(e):
            raise
        logger.warning(
            "MP: columna opcional ausente (mercadopago_seller_activity_url); "
            "reintentando sin URL Actividades. Ejecutá Database/add_mercadopago_seller_activity_url.sql — %s",
            e,
        )
        pedido = (
            db.query(Pedido)
            .options(*_opciones_carga_pedido())
            .filter(Pedido.id_pedido == id_pedido)
            .first()
        )
        if not pedido:
            raise RuntimeError(f"pedido {id_pedido} no encontrado tras rollback") from e
        _volcar_estado_pago_mp_en_pedido(pedido, pay, skip_seller_activity_url=True)
        db.add(pedido)
        db.commit()


def _volcar_estado_pago_mp_en_pedido(
    pedido: Pedido,
    pay: dict,
    *,
    skip_seller_activity_url: bool = False,
) -> None:
    """Actualiza pedido con id/referencia, comprobante URL y estado según respuesta MP."""
    from utils import mercadopago_api as mp_api

    pay_id_str = str(pay.get("id", ""))
    st = pay.get("status") or ""
    rec = mp_api.receipt_url_de_pago(pay)
    if rec:
        pedido.mercadopago_receipt_url = rec

    if not skip_seller_activity_url:
        try:
            act = mp_api.url_actividad_vendedor_desde_pago(pay)
            if act:
                pedido.mercadopago_seller_activity_url = act
        except Exception as e:
            logger.warning("MP actividad vendedor (no bloquea asociación del pago): %s", e)

    if st == "approved":
        pedido.mercadopago_payment_id = pay_id_str
        pedido.mercadopago_referencia = pay_id_str
        if pedido.estado == "PENDIENTE_CONFIRMACION_MP":
            pedido.estado = "PENDIENTE"
    elif st in ("pending", "in_process", "in_mediation"):
        if not pedido.mercadopago_payment_id:
            pedido.mercadopago_payment_id = pay_id_str
            pedido.mercadopago_referencia = pay_id_str
    else:
        if not pedido.mercadopago_payment_id:
            pedido.mercadopago_payment_id = pay_id_str
            pedido.mercadopago_referencia = pay_id_str


def sincronizar_pago_mercadopago(
    db: Session,
    sync: MercadoPagoSyncIn,
) -> Tuple[Optional[PedidoOut], str]:
    """
    Consulta el pago en la API de MP y actualiza el pedido (external_reference = id_pedido).
    Puede resolver el pago por ID, por búsqueda con external_reference o por preference_id.
    Devuelve (pedido, "") o (None, mensaje para mostrar en API).
    """
    from utils import mercadopago_api as mp_api

    if not mp_api.mp_token_configurado():
        logger.warning("MP sincronizar: MERCADOPAGO_ACCESS_TOKEN vacío.")
        return (
            None,
            "Configurá MERCADOPAGO_ACCESS_TOKEN en el servidor.",
        )

    pid_raw = (sync.payment_id or "").strip()
    pid = mp_api.normalizar_payment_id_input(pid_raw) if pid_raw else ""

    ext_str = str(sync.external_reference).strip() if sync.external_reference else ""
    pref_str = str(sync.preference_id).strip() if sync.preference_id else ""
    ext_desde_pref: Optional[int] = None
    if pref_str:
        ext_desde_pref = mp_api.external_reference_desde_preferencia(pref_str)

    pay: Optional[Dict[str, Any]] = None
    # Tras el redirect, GET /payments/{id} o la búsqueda por external_reference a veces fallan 1–5 s.
    for intento in range(6):
        if intento:
            time.sleep(1.0)
        if pid:
            pay = mp_api.obtener_pago(pid)
            if pay:
                break
        if ext_str:
            pay = mp_api.buscar_ultimo_pago_por_external_reference(ext_str)
            if pay:
                break
        if ext_desde_pref is not None:
            pay = mp_api.buscar_ultimo_pago_por_external_reference(str(ext_desde_pref))
            if pay:
                break

    if not pay:
        logger.warning(
            "MP sincronizar: no se obtuvo pago (payment_id=%s ext=%s pref=%s)",
            pid or "(vacío)",
            sync.external_reference,
            sync.preference_id,
        )
        return (
            None,
            "Mercado Pago no devolvió el pago (revisá payment_id o esperá unos segundos y reintentá). "
            "Si pagaste con el link fijo del negocio sin pasar por el checkout del pedido, usá Seguimiento → asociar pago.",
        )

    id_pedido = mp_api.external_reference_de_pago(pay)
    if id_pedido is None and sync.external_reference:
        id_pedido = _parse_id_pedido_ref(sync.external_reference)
    if id_pedido is None and sync.preference_id:
        id_pedido = mp_api.external_reference_desde_preferencia(str(sync.preference_id).strip())

    if id_pedido is None:
        logger.warning(
            "MP sincronizar: pago %s sin external_reference resoluble (body/url).",
            pay.get("id"),
        )
        return (
            None,
            "El pago no está vinculado al número de pedido (external_reference). "
            "Asegurate de haber pagado desde el botón del carrito (Checkout Pro), no solo desde el link de cobro.",
        )

    ref_en_pago = mp_api.external_reference_de_pago(pay)
    if ref_en_pago is not None and ref_en_pago != id_pedido:
        logger.warning(
            "MP sincronizar: conflicto external_reference pago=%s vs resuelto=%s",
            ref_en_pago,
            id_pedido,
        )
        return (None, "Los datos del pago no coinciden con el pedido (referencia distinta).")

    pedido = (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.id_pedido == id_pedido)
        .first()
    )
    if not pedido:
        return (None, f"No existe el pedido #{id_pedido} en la base.")
    if pedido.medio_pago != "mercadopago":
        return (
            None,
            "Ese pedido no fue registrado con Mercado Pago (medio de pago distinto).",
        )

    if not _pago_mercadopago_coincide_con_pedido(pedido, pay):
        return (
            None,
            "El monto o moneda del pago en Mercado Pago no coincide con el total del pedido. "
            f"Pedido ${pedido.total} — revisá en la consola del backend el log MP monto.",
        )

    _volcar_estado_pago_mp_en_pedido(pedido, pay)

    try:
        _commit_pedido_tras_volcar_mp(db, pedido, pay)
    except Exception as e:
        logger.exception("MP sincronizar: error al guardar pedido %s", id_pedido)
        return (None, f"Error al guardar en la base: {e!s}")

    logger.info(
        "MP sincronizar OK pedido=%s payment_id=%s",
        id_pedido,
        pay.get("id"),
    )

    pedido = (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.id_pedido == id_pedido)
        .first()
    )
    if not pedido:
        return (None, "Error interno al recargar el pedido tras guardar.")
    return (pedido_a_respuesta(pedido), "")


def asociar_pago_link_mercadopago(db: Session, token: str, payment_id_raw: str) -> PedidoOut:
    """
    Pago hecho por link de cobro (sin external_reference): valida monto y asocia al pedido del token.
    """
    from utils import mercadopago_api as mp_api

    tok = (token or "").strip()
    pid = mp_api.normalizar_payment_id_input(payment_id_raw)
    if not tok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Falta el token de seguimiento.",
        )
    if not pid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingresá el número de operación.",
        )
    if not mp_api.mp_token_configurado():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mercado Pago no está configurado en el servidor.",
        )

    pedido = (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.token_seguimiento == tok)
        .first()
    )
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado.",
        )
    if pedido.medio_pago != "mercadopago":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pedido no fue hecho con Mercado Pago.",
        )
    if pedido.estado in ("CANCELADO", "ENTREGADO"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pedido ya no admite asociar pagos.",
        )

    pay = None
    for intento in range(6):
        if intento:
            time.sleep(1.0)
        pay = mp_api.obtener_pago(pid)
        if pay:
            break
    if not pay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos ese pago en Mercado Pago. Revisá el número de operación.",
        )

    ext = mp_api.external_reference_de_pago(pay)
    if ext is not None and ext != pedido.id_pedido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pago está asociado a otro pedido en Mercado Pago.",
        )

    if not _pago_mercadopago_coincide_con_pedido(pedido, pay):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto del pago no coincide con el total del pedido.",
        )

    pay_id_str = str(pay.get("id", ""))
    dup = (
        db.query(Pedido)
        .filter(
            Pedido.mercadopago_payment_id == pay_id_str,
            Pedido.id_pedido != pedido.id_pedido,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pago ya está asociado a otro pedido.",
        )

    _volcar_estado_pago_mp_en_pedido(pedido, pay)
    try:
        _commit_pedido_tras_volcar_mp(db, pedido, pay)
    except Exception as e:
        logger.exception("MP asociar link: error al guardar pedido %s", pedido.id_pedido)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar el pedido: {e!s}",
        ) from e

    pedido = (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.id_pedido == pedido.id_pedido)
        .first()
    )
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al guardar el pedido.",
        )
    return pedido_a_respuesta(pedido)


def obtener_pedido_por_id(db: Session, id_pedido: int) -> Optional[Pedido]:
    return (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.id_pedido == id_pedido)
        .first()
    )


def obtener_pedido_por_token(db: Session, token: str) -> Optional[Pedido]:
    if not token or not token.strip():
        return None
    return (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.token_seguimiento == token.strip())
        .first()
    )


def _ids_cliente_por_telefono_normalizado(db: Session, norm: str) -> List[int]:
    """MySQL 8+ / MariaDB 10.0.5+: búsqueda por dígitos; si no hay REGEXP_REPLACE, fallback O(n)."""
    variants = _variantes_digitos_telefono_uy(norm)
    if not variants:
        return []
    try:
        placeholders = ", ".join(f":v{i}" for i in range(len(variants)))
        r = db.execute(
            text(
                "SELECT id_cliente FROM cliente WHERE "
                f"REGEXP_REPLACE(COALESCE(telefono, ''), '[^0-9]', '') IN ({placeholders})"
            ),
            {f"v{i}": v for i, v in enumerate(variants)},
        )
        return [row[0] for row in r.fetchall()]
    except (ProgrammingError, OperationalError) as e:
        logger.warning("Consulta teléfono: REGEXP_REPLACE no disponible, fallback (%s)", e)
        return [
            cid
            for cid, tel in db.query(Cliente.id_cliente, Cliente.telefono).all()
            if normalizar_telefono(tel) == norm
        ]


def listar_pedidos_por_telefono(db: Session, telefono_raw: str) -> List[PedidoOut]:
    norm = normalizar_telefono(telefono_raw)
    if len(norm) < 8:
        return []
    ids_cliente = _ids_cliente_por_telefono_normalizado(db, norm)
    if not ids_cliente:
        return []
    pedidos = (
        db.query(Pedido)
        .options(*_opciones_carga_pedido())
        .filter(Pedido.id_cliente.in_(ids_cliente))
        .filter(Pedido.estado != "ENTREGADO")
        .filter(Pedido.estado != "PENDIENTE")
        .order_by(Pedido.id_pedido.desc())
        .all()
    )
    return [pedido_a_respuesta(p) for p in pedidos]


def listar_pedidos_para_staff(
    db: Session,
    filtro_estado: Optional[str] = None,
    id_repartidor: Optional[int] = None,
) -> List[PedidoOut]:
    q = db.query(Pedido).options(*_opciones_carga_pedido())
    if filtro_estado:
        q = q.filter(Pedido.estado == filtro_estado)
    if id_repartidor is not None:
        q = q.filter(Pedido.id_repartidor == id_repartidor)
    # Cola tipo cocina: primero quien pidió antes (FIFO). MySQL no admite NULLS LAST en ORDER BY;
    # pedimos primero filas con fecha (IS NULL = 0) y al final las sin created_at.
    pedidos = q.order_by(
        asc(Pedido.created_at.is_(None)),
        asc(Pedido.created_at),
        asc(Pedido.id_pedido),
    ).all()
    return [pedido_a_respuesta(p) for p in pedidos]


def actualizar_estado_pedido(
    db: Session,
    id_pedido: int,
    nuevo_estado: str,
    id_repartidor: Optional[int] = None,
) -> Optional[PedidoOut]:
    if nuevo_estado not in ESTADOS_PEDIDO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado inválido",
        )
    pedido = obtener_pedido_por_id(db, id_pedido)
    if not pedido:
        return None

    if nuevo_estado == "PENDIENTE_CONFIRMACION_MP":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ese estado solo se asigna al crear un pedido con Mercado Pago.",
        )

    if pedido.estado == "PENDIENTE_CONFIRMACION_MP":
        if nuevo_estado not in ("PENDIENTE", "CANCELADO"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mercado Pago: confirmá el pago (Recibido) o cancelá el pedido antes de otro estado.",
            )

    if nuevo_estado == "EN_CAMINO":
        if not id_repartidor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seleccioná un repartidor para poner el pedido en la calle.",
            )
        rep = (
            db.query(Staff)
            .filter(
                Staff.id == id_repartidor,
                Staff.role == "repartidor",
                Staff.is_active.is_(True),
            )
            .first()
        )
        if not rep:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Repartidor inválido o inactivo.",
            )
        pedido.id_repartidor = id_repartidor
    elif nuevo_estado == "ENTREGADO":
        pass
    else:
        pedido.id_repartidor = None

    pedido.estado = nuevo_estado
    db.commit()
    recargado = obtener_pedido_por_id(db, id_pedido)
    assert recargado
    return pedido_a_respuesta(recargado)


def marcar_entregado_repartidor(
    db: Session, id_pedido: int, id_repartidor: int
) -> Optional[PedidoOut]:
    pedido = obtener_pedido_por_id(db, id_pedido)
    if not pedido:
        return None
    if pedido.estado != "EN_CAMINO":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se puede marcar como entregado un pedido en la calle (EN_CAMINO).",
        )
    if pedido.id_repartidor != id_repartidor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este pedido no está asignado a tu cuenta.",
        )
    pedido.estado = "ENTREGADO"
    db.commit()
    recargado = obtener_pedido_por_id(db, id_pedido)
    assert recargado
    return pedido_a_respuesta(recargado)
