import json
import logging
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

import crud.pedido as crud_pedido
from database import get_db
from deps.rate_limit import rate_limit_crear_pedido, rate_limit_mp_sync, rate_limit_seguimiento_tel
from schemas import MercadoPagoAsociarLinkIn, MercadoPagoSyncIn, PedidoCrearIn, PedidoOut
from schemas.pedido import ALLOWED_COMPROBANTE_EXT, MAX_COMPROBANTE_BYTES, TelefonoSeguimientoIn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])


def _inferir_extension_comprobante(
    filename: Optional[str], content_type: Optional[str], data: bytes
) -> str:
    """Algunos navegadores envían PDF/imagen sin nombre o sin extensión; inferimos de tipo o firma."""
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_COMPROBANTE_EXT:
            return ext
    ct = (content_type or "").lower()
    if "pdf" in ct:
        return ".pdf"
    if "png" in ct:
        return ".png"
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    if "webp" in ct:
        return ".webp"
    if len(data) >= 4 and data[:4] == b"%PDF":
        return ".pdf"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return ".pdf"


async def _leer_comprobante_desde_form(raw_comp) -> Optional[Tuple[bytes, str]]:
    """Acepta UploadFile de Starlette/FastAPI u objetos con read() async (sin depender solo de isinstance)."""
    if raw_comp is None:
        return None
    read = getattr(raw_comp, "read", None)
    if not callable(read):
        return None
    data = await raw_comp.read()
    if not data:
        return None
    filename = getattr(raw_comp, "filename", None)
    content_type = getattr(raw_comp, "content_type", None)
    ext = _inferir_extension_comprobante(filename, content_type, data)
    if ext not in ALLOWED_COMPROBANTE_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comprobante: usá JPG, PNG, WebP o PDF.",
        )
    if len(data) > MAX_COMPROBANTE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo supera 5 MB.",
        )
    return (data, ext)


async def _extraer_comprobante_del_form(form) -> Optional[Tuple[bytes, str]]:
    """Solo el campo `comprobante` (evita tomar archivos adjuntos a otros nombres por error)."""
    raw = form.get("comprobante")
    return await _leer_comprobante_desde_form(raw)


async def _tuple_desde_uploadfile(comprobante: UploadFile) -> Optional[Tuple[bytes, str]]:
    data = await comprobante.read()
    if not data:
        return None
    ext = _inferir_extension_comprobante(comprobante.filename, comprobante.content_type, data)
    if ext not in ALLOWED_COMPROBANTE_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comprobante: usá JPG, PNG, WebP o PDF.",
        )
    if len(data) > MAX_COMPROBANTE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo supera 5 MB.",
        )
    return (data, ext)


@router.post("/form", response_model=PedidoOut, status_code=status.HTTP_201_CREATED)
async def crear_pedido_form(
    pedido: str = Form(..., description="JSON string PedidoCrearIn"),
    comprobante: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_crear_pedido),
):
    """
    Mismo resultado que POST / con multipart, pero usando Form+File de FastAPI (multipart estable).
    Recomendado desde el front web al adjuntar comprobante.
    """
    payload = PedidoCrearIn.model_validate_json(pedido)
    comp_tuple = None
    if comprobante is not None:
        comp_tuple = await _tuple_desde_uploadfile(comprobante)
    return crud_pedido.crear_pedido_web(db, payload, comp_tuple)


@router.post("/", response_model=PedidoOut, status_code=status.HTTP_201_CREATED)
async def crear_pedido(
    request: Request,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_crear_pedido),
):
    """
    Crear pedido.

    - `application/json`: cuerpo PedidoCrearIn (sin archivo).
    - `multipart/form-data`: campo `pedido` = JSON string; opcional `comprobante` (solo Mercado Pago).

    Mercado Pago (futuro): con Checkout Pro + webhook o URL de retorno, podés guardar
    `mercadopago_payment_id` consultando la API de MP con el `payment_id` de la redirección,
    sin que el cliente suba captura.
    """
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        body = await request.json()
        payload = PedidoCrearIn.model_validate(body)
        return crud_pedido.crear_pedido_web(db, payload, None)

    if "multipart/form-data" not in content_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Usá application/json o multipart/form-data",
        )

    form = await request.form()
    pedido_str = form.get("pedido")
    if not pedido_str or not isinstance(pedido_str, str):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Falta el campo formulario 'pedido' (JSON).",
        )
    payload = PedidoCrearIn.model_validate_json(pedido_str)

    comp_tuple = await _extraer_comprobante_del_form(form)

    return crud_pedido.crear_pedido_web(db, payload, comp_tuple)


@router.post("/mercadopago/sincronizar", response_model=PedidoOut)
def mercadopago_sincronizar(
    body: MercadoPagoSyncIn,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_mp_sync),
):
    """
    Tras volver de Checkout Pro (o para forzar sync), consulta el pago en MP y actualiza el pedido.
    Público: el `payment_id` no es adivinable fácilmente; el pedido se identifica por `external_reference`.
    """
    out, err = crud_pedido.sincronizar_pago_mercadopago(db, body)
    if not out:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=err or "No se pudo sincronizar el pago.",
        )
    return out


@router.post("/mercadopago/asociar-link", response_model=PedidoOut)
def mercadopago_asociar_link(
    body: MercadoPagoAsociarLinkIn,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_mp_sync),
):
    """
    Asocia un pago hecho por el link de cobro del negocio (sin `external_reference`) al pedido del
    `token_seguimiento`. Exige que el monto en MP coincida con el total del pedido.
    """
    return crud_pedido.asociar_pago_link_mercadopago(db, body.token_seguimiento, body.payment_id)


@router.api_route("/mercadopago/webhook", methods=["GET", "POST"])
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Notificaciones IPN / webhooks de Mercado Pago. Configurá BACKEND_PUBLIC_URL + opcional MERCADOPAGO_WEBHOOK_SECRET en la query (?s=...).
    """
    from utils.mercadopago_api import webhook_secret

    sec = webhook_secret()
    if sec and request.query_params.get("s") != sec:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook no autorizado")

    payment_id = None
    if request.method == "GET":
        if request.query_params.get("topic") == "payment":
            payment_id = request.query_params.get("id")
    else:
        body = None
        try:
            body = await request.json()
        except json.JSONDecodeError as e:
            logger.info("Webhook MP: cuerpo no JSON (%s)", e)
        except ValueError as e:
            logger.info("Webhook MP: no se pudo parsear JSON (%s)", e)
        if isinstance(body, dict):
            data = body.get("data")
            if isinstance(data, dict) and data.get("id") is not None:
                payment_id = str(data["id"])
            if not payment_id and body.get("id") is not None:
                payment_id = str(body["id"])

    if payment_id:
        try:
            _out, err = crud_pedido.sincronizar_pago_mercadopago(
                db,
                MercadoPagoSyncIn(payment_id=str(payment_id)),
            )
            if not _out and err:
                logger.warning("Webhook MP: no se actualizó pedido (%s)", err)
        except Exception:
            logger.exception("Webhook MP: error al sincronizar payment_id=%s", payment_id)
    else:
        logger.debug("Webhook MP: sin payment_id (GET/POST)")

    return {"received": True}


@router.get("/seguimiento/{token}", response_model=PedidoOut)
def seguimiento_por_token(token: str, db: Session = Depends(get_db)):
    """
    Consulta pública del estado del pedido usando el token secreto del enlace
    (sin login). No usar el número de pedido solo: el token no es adivinable.
    """
    pedido = crud_pedido.obtener_pedido_por_token(db, token)
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enlace inválido o pedido no encontrado",
        )
    return crud_pedido.pedido_a_respuesta(pedido)


@router.post("/consulta-seguimiento-telefono", response_model=List[PedidoOut])
def seguimiento_por_telefono(
    body: TelefonoSeguimientoIn,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_seguimiento_tel),
):
    """
    Lista pedidos del cliente cuyo teléfono coincide (ignorando espacios y guiones).
    No incluye **ENTREGADO** ni **Recibido** (`PENDIENTE`); sí incluye Mercado Pago pendiente
    de confirmación del local.

    Vacío si no hay coincidencias o el número tiene menos de 8 dígitos.

    Ruta aparte de `/seguimiento/{token}` para evitar que Starlette tome el segmento
    como token y responda 405 en POST.
    """
    return crud_pedido.listar_pedidos_por_telefono(db, body.telefono)
