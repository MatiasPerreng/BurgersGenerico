# Simular pagos con Mercado Pago (tarjetas ficticias)

Sirve para probar Checkout Pro: el pedido queda con **`mercadopago_payment_id`**, referencia y estado **Recibido** (`PENDIENTE`) en el panel admin.

## 1. Credenciales de **prueba** (no producción)

1. Entrá a [Tus integraciones](https://www.mercadopago.com.uy/developers/panel/app) → tu aplicación.
2. En **Credenciales**, activá el modo **Prueba** (no uses el Access Token de producción para desarrollo).
3. Copiá el **Access Token** de prueba en el `.env` del backend:

   `MERCADOPAGO_ACCESS_TOKEN=...`

   Opcional: la **Public Key** (mismo panel, modo Prueba) puede ir en `MERCADOPAGO_PUBLIC_KEY` en el backend y/o en `VITE_MERCADOPAGO_PUBLIC_KEY` en el `.env` del front si más adelante usás Bricks; el redirect a Checkout Pro solo necesita el Access Token.

4. Configurá también:

   - `PUBLIC_FRONTEND_URL=http://localhost:5173` (o el puerto de tu Vite).
   - `CORS_ORIGINS` debe incluir ese mismo origen.

Reiniciá **uvicorn** después de cambiar `.env`.

## 2. Hacer un pedido de prueba en tu web

1. Levantá backend (`uvicorn`) y frontend (`npm run dev`).
2. En **Tu pedido**, elegí **Mercado Pago**, **sin** número de operación y **sin** comprobante (así se genera la preferencia y el botón **Pagar con Mercado Pago**).
3. Confirmá: deberías ser **redirigido** al checkout de Mercado Pago (entorno de prueba).

Si no redirige, el token no está bien o el backend no pudo crear la preferencia (revisá logs de uvicorn).

## 3. Pagar con tarjeta ficticia

Mercado Pago documenta las tarjetas y reglas en:

**[Tarjetas de prueba (Checkout Pro / Uruguay)](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards)**

Resumen habitual para **pago aprobado**:

| Campo        | Valor de ejemplo                          |
|-------------|---------------------------------------------|
| Número      | Una de las tarjetas de prueba del link oficial (ej. Visa/Mastercard que figure en la doc). |
| Vencimiento | Fecha futura (ej. **11/30**).             |
| CVV         | **123** (si la tabla lo indica).          |
| Titular     | **`APRO`** (nombre y apellido) para que el pago sea **aprobado**. |
| Documento   | Si lo pide, algo tipo **12345678** según la doc. |

Otros nombres en el titular simulan otros resultados (pendiente, rechazo, etc.); está detallado en la misma página de MP.

## 4. Volver a tu sitio y sincronizar

1. Al terminar el pago, MP redirige a **`/pedido/pago-resultado`** con `payment_id` en la URL.
2. Esa página llama a `POST /pedidos/mercadopago/sincronizar` y el backend guarda el pago en el pedido.

Si cerrás el navegador antes, podés seguir: con **`BACKEND_PUBLIC_URL`** público (ej. ngrok) MP también puede avisar por **webhook**; si no, al abrir de nuevo el enlace de retorno o al consultar seguimiento/admin tras un sync manual, el dato puede aparecer cuando el webhook o un nuevo sync se ejecute.

## 5. Qué revisar en **Admin**

- En la **card** del pedido: franja **Pago MP** con el ID.
- **Detalle**: sección **Pago Mercado Pago** con **ID de pago (MP)** y referencia.
- El pedido debería pasar de *Mercado Pago — confirmar pago* a **Recibido** si el pago quedó **aprobado**.

## 6. Usuario comprador de prueba (alternativa)

En el panel de Developers podés crear un **usuario de prueba tipo Comprador** e iniciar sesión en el checkout con ese usuario en lugar de solo tarjeta, según el flujo que muestre MP.

---

**Importante:** Las tarjetas reales **no** deben usarse en modo prueba; los pagos de prueba no mueven dinero real.
