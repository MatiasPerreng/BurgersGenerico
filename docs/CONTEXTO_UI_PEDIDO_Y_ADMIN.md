# Contexto: UI pedido, admin y red (Proyecto Burgers)

Documento de referencia para retomar el trabajo sin perder decisiones ya tomadas.

## Página `/pedido` (`Frontend/Burgers/src/pages/Pedido/`)

### Layout actual

1. **Solo el menú (catálogo)** ocupa el flujo principal: panel `pedido-panel pedido-panel--catalog` dentro de `pedido-flow`.
2. **Carrito y formulario no están en el mismo layout vertical** que el catálogo.
3. **Botón flotante** `pedido-cart-fab`: abre un **panel lateral** (`pedido-drawer`) desde la derecha.
4. **Dentro del drawer, dos pasos** (`carritoDrawerPaso`: `"carrito"` | `"form"`):
   - **Carrito**: líneas (`lineasCarrito`), total, botón **Realizar pedido** (deshabilitado si no hay ítems).
   - **Formulario**: enlace **← Volver al carrito**, mismo `<form>` de entrega/pago/envío que antes (submit `handleSubmit`).

### Estado React relevante

- `carritoDrawerOpen`, `carritoDrawerPaso`.
- `lineasCarrito` (`useMemo` desde `productos` + `carrito`).
- Con drawer abierto: `document.body.style.overflow = "hidden"`; **Escape** cierra el drawer.
- Al pasar a `"form"`, scroll de `.pedido-drawer__body` al inicio (`useEffect`).
- Tras pedido exitoso: `setCarritoDrawerOpen(false)`, `setCarritoDrawerPaso("carrito")` (flujos MP y no MP en `handleSubmit`).

### Estilos

- `PedidoPage.css`: `.pedido-flow`, `.pedido-cart-fab`, `.pedido-drawer` (backdrop, panel, head, body, `.pedido-drawer__cta`, etc.).
- Padding inferior en `pedido-flow` para no tapar contenido con el FAB.

---

## API y front en red / otra máquina

- Backend: `Backend/package.json` → `uvicorn` con `--host 0.0.0.0 --port 8000`.
- Front: Vite con host `0.0.0.0` y proxy `/api` → `127.0.0.1:8000` (`Frontend/Burgers/vite.config.js`).
- **`Frontend/Burgers/src/services/api.js`**: con `VITE_API_URL` vacío, en el navegador la base es **`/api`** (proxy de Vite), no `http://host:8000` directo, para no depender del puerto 8000 expuesto en firewall.
- **`Backend/main.py`**: `load_dotenv()` al inicio; `CORS_ORIGIN_REGEX` opcional (ej. regex para puertos de Vite); `CORS_ORIGINS` para orígenes explícitos.
- `.env` del backend: `PUBLIC_FRONTEND_URL` acorde al host donde se abre el front (ej. IP pública) si se usa Mercado Pago `back_urls`.

---

## Panel `/admin` (`Frontend/Burgers/src/pages/Admin/`)

### Responsive móvil (orden de ideas)

- Cards de pedido: franja izquierda **`::before`** en color **cian sólido** (`var(--lbv-cyan)`), sin degradado multicolor.
- **Fecha/hora** en móvil (≤700px): `footer` con `display: contents` + **grid** en `.admin-order`: datetime arriba a la derecha (`grid-row: 1`), contenido principal debajo; tipografía más chica para datetime.
- **Carrito admin** (lista pedidos): sectores Cliente/Entrega con cajas y acentos naranja/cian; aside con total destacado; selects repartidor/estado en dos columnas salvo bloque MP confirmación (full width).
- **Drawer modal** de detalle de pedido en móvil: estilo hoja inferior (~576px).
- **StaffGate** (`StaffGate.css`): safe-area en login admin.

### Archivos

- `AdminPage.jsx`, `AdminPage.css`.
- CORS y layout de órdenes documentados arriba si afectan pruebas desde IP.

---

## Reinicio de servidores (desarrollo)

- Tras cambios en `vite.config.js`, `.env` del front, o CORS/`.env` del backend: reiniciar Vite y/o uvicorn según corresponda (ver regla del repo sobre reinicios).

---

*Generado como memoria de contexto de implementación; actualizar si el comportamiento cambia.*
