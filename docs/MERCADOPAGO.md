# Mercado Pago — contexto e integración (Proyecto Burgers)

Este documento resume cómo quedó armado el flujo de **Mercado Pago (Checkout Pro)**, qué se reparó o endureció para que el pago quede **asociado al pedido**, y cómo el **frontend** muestra el **número de operación** enlazado al comprobante web.

Para **tarjetas de prueba y pasos manuales de test**, ver además: [`Backend/docs/MERCADOPAGO_PRUEBAS.md`](../Backend/docs/MERCADOPAGO_PRUEBAS.md).

---

## Flujo resumido

1. El cliente arma el pedido y elige **Mercado Pago**.
2. El backend crea una **preferencia Checkout Pro** con `external_reference` = **`id_pedido`** (como string). Así, cuando MP acredita el pago, la API de pagos permite resolver **qué pedido** corresponde.
3. Tras el pago, el cliente vuelve al front (`/pedido/pago-resultado`) o usa **Seguimiento**; el front llama a **`POST /pedidos/mercadopago/sincronizar`** (a veces con reintentos) para que el backend consulte MP y guarde `mercadopago_payment_id`, referencia, estado del pedido, etc.
4. Opcional: **webhook** en `GET|POST /pedidos/mercadopago/webhook` (requiere `BACKEND_PUBLIC_URL` y, si se configura, `MERCADOPAGO_WEBHOOK_SECRET` en query `?s=`).
5. Si el cliente pagó por el **link fijo del negocio** (sin `external_reference` al pedido), puede **asociar manualmente** el pago con **`POST /pedidos/mercadopago/asociar-link`** (token de seguimiento + `payment_id` / número de operación).

---

## Endpoints relevantes (backend)

| Método | Ruta | Rol |
|--------|------|-----|
| `POST` | `/pedidos/mercadopago/sincronizar` | Cuerpo: `MercadoPagoSyncIn` (`payment_id`, `external_reference`, `preference_id` en combinaciones según el caso). Consulta MP y actualiza el pedido. |
| `POST` | `/pedidos/mercadopago/asociar-link` | Asocia un pago al pedido del `token_seguimiento` cuando no hubo Checkout Pro con `external_reference`. |
| `GET`/`POST` | `/pedidos/mercadopago/webhook` | Notificaciones MP; dispara sincronización cuando hay `payment_id`. |

Implementación: `Backend/routers/pedidos.py`. Lógica de negocio: `Backend/crud/pedido.py`. Cliente HTTP y preferencias: `Backend/utils/mercadopago_api.py`.

---

## Base de datos (MySQL)

Columnas útiles en `pedido` (además de `medio_pago`, `estado`, etc.):

- `mercadopago_referencia`, `mercadopago_payment_id` — identifican la operación en MP.
- `mercadopago_receipt_url` — URL que devuelve la API de MP al consultar el pago (PDF/recibo según MP). **Migración:** `Database/add_mercadopago_receipt_url.sql`.
- `mercadopago_seller_activity_url` — URL opcional derivada del JSON del pago / búsqueda de órdenes (Actividades vendedor). **Migración:** `Database/add_mercadopago_seller_activity_url.sql`.

Si el modelo SQLAlchemy incluye una columna que **no existe** en MySQL, los `SELECT`/`UPDATE` fallan. Por eso hay que aplicar las migraciones en ambientes que usen el código actual.

### Reparación: commit cuando falta columna opcional

En `Backend/crud/pedido.py`, si al guardar tras sincronizar MySQL falla por columna desconocida (p. ej. `mercadopago_seller_activity_url`), el código **reintenta el commit** volcando el pago **sin** escribir esa URL, para **no bloquear** el guardado de `mercadopago_payment_id`. Igual conviene ejecutar el `ALTER` correspondiente.

---

## Backend: sincronización y validación

- **`sincronizar_pago_mercadopago`**: obtiene el pago por `GET /v1/payments/{id}` y/o búsqueda por `external_reference`, resuelve `id_pedido`, valida moneda (**UYU**), monto (~coincide con el total del pedido) y vuelca datos al pedido.
- **`_volcar_estado_pago_mp_en_pedido`**: escribe `mercadopago_payment_id`, `mercadopago_referencia`, `mercadopago_receipt_url` si viene en el JSON, y opcionalmente URL de actividad vendedor vía `url_actividad_vendedor_desde_pago` (incluye fallback con `merchant_orders/search` por `external_reference` cuando el JSON del pago no trae `order.id` / `merchant_order_id`).
- **Variables de entorno** (ver `Backend/.env.example`): `MERCADOPAGO_ACCESS_TOKEN`, `PUBLIC_FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_LINK_PAGO`, hosts opcionales, etc.

---

## Frontend: número de operación y comprobante visible

No se usa la URL de la **API REST** de MP en el navegador (suele dar **401**). En su lugar, el hipervínculo del **número de operación** apunta al **comprobante web** de Mercado Pago Uruguay:

`https://www.mercadopago.com.uy/tools/receipt-view/{número}`

- Helper central: `Frontend/Burgers/src/services/mercadopagoSync.js` — funciones `mercadoPagoPaymentIdDesdeTexto`, `urlMercadoPagoReceiptViewPorOperacion`.
- Host configurable: `VITE_MERCADOPAGO_RECEIPT_VIEW_HOST` (por defecto `www.mercadopago.com.uy`). Ver `Frontend/Burgers/.env.example`.
- Uso en **Admin** (`MercadoPagoComprobanteLink`), **Seguimiento**, **Pedido** (mensaje de éxito) y **PedidoPagoResultado** (prioridad: receipt-view; si no hay dígitos parseables, puede usarse `mercadopago_receipt_url` del backend como respaldo).

**Resiliencia en la página del pedido (`/pedido`):** tras abrir Checkout en otra pestaña, el cliente hace **polling** al endpoint de sincronizar (intervalo ~4 s, tope ~10 min); **`sessionStorage`** guarda el estado del pedido pendiente para **recuperar tras F5** o cerrar la pestaña (TTL 24 h); **`BroadcastChannel`** `lbv-mp-pedido` actualiza la pestaña del pedido cuando en **`/pedido/pago-resultado`** el sync ya devolvió el pago; al **volver el foco** a la pestaña del pedido se fuerza un sync inmediato; si se agota el tiempo sin confirmar, se muestra aviso con enlace a **Seguimiento**. En **Seguimiento**, si el estado es `PENDIENTE_CONFIRMACION_MP` sin n° aún, se muestra un texto orientativo.

Sincronización automática en admin: polling ~25 s y/o llamada a `sincronizarPagoMercadoPagoPorPedidoConReintentos` cuando el pedido MP aún no tiene `mercadopago_payment_id`.

---

## Problemas que se corrigieron o mitigaron (historial)

1. **Pago no asociado / commit fallido** — A veces faltaba migrar columnas nuevas; el ORM fallaba al persistir. Se añadió **reintento de commit sin URL opcional** y se documentó ejecutar los `ALTER` de `Database/`.
2. **Enlace útil para el negocio** — Las URLs tipo API o Actividades complejas no eran prácticas; se unificó el criterio del **receipt-view** con el número de operación guardado.
3. **Índice tardío en MP** — Reintentos en el cliente (`sincronizarPagoMercadoPagoPorPedidoConReintentos`) y bucles con espera en el backend al consultar pagos.

---

## Checklist rápido en un entorno nuevo

1. `MERCADOPAGO_ACCESS_TOKEN` en el backend (credencial de la app en [developers](https://www.mercadopago.com.uy/developers/panel/app)).
2. `PUBLIC_FRONTEND_URL` coherente con el origen del front (Vite).
3. Ejecutar migraciones SQL necesarias (`add_mercadopago_receipt_url.sql`, `add_mercadopago_seller_activity_url.sql` si el modelo las incluye).
4. Webhook: URL pública al backend + secreto opcional.
5. Probar un pago de prueba siguiendo `Backend/docs/MERCADOPAGO_PRUEBAS.md`.

---

*Última actualización del documento: alineado con la integración Checkout Pro + receipt-view y crud de sincronización descritos arriba.*
