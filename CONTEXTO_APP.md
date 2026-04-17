# La Buena Vida Burgers — Contexto del proyecto

Documento para retomar el desarrollo sin perder el hilo. Repo remoto: **https://github.com/MatiasPerreng/Burguers.git** (rama `main`).

---

## Qué es

Web de pedidos para hamburguesería **“La Buena Vida Burgers”**: catálogo (home), carrito + formulario de entrega (`/pedido`), seguimiento público por token (`/seguimiento/:token`), panel **admin** (cocina / estados) y panel **repartidor** (pedidos en la calle). Backend **FastAPI** + **MySQL**, frontend **Vite + React**.

---

## Estructura de carpetas (útil)

```
ProyectoBurgers/
├── Backend/                 # API FastAPI
│   ├── main.py              # Routers: productos, pedidos, auth, admin, repartidor
│   ├── database.py          # SQLAlchemy engine + SessionLocal, DATABASE_URL
│   ├── deps/auth.py         # JWT (OAuth2 bearer), require_admin, require_repartidor
│   ├── crud/                # pedido.py, staff.py, producto.py, cliente.py
│   ├── models/              # Pedido (id_repartidor FK staff), Staff, Cliente, Producto…
│   ├── routers/             # auth.py, admin.py, repartidor.py, pedidos.py, productos.py
│   ├── schemas/             # PedidoOut, LoginIn, PedidoEstadoPatch…
│   ├── utils/passwords.py   # pbkdf2_sha256 + bcrypt legacy
│   ├── scripts/             # seed_admin, seed_repartidor, add_pedido_id_repartidor, resync_staff_users…
│   └── static/productos|comprobantes
├── Database/                # SQL: burgers_schema.sql + migraciones incrementales
├── Frontend/Burgers/        # React (Vite)
│   ├── src/pages/           # Home, Pedido, Seguimiento, Admin, Repartidor
│   ├── src/components/      # Navbar, Footer, StaffGate, MapEmbed…
│   ├── src/services/api.js  # VITE_API_URL o "/api" (proxy dev)
│   └── vite.config.js       # proxy /api → backend :8000
└── CONTEXTO_APP.md          # Este archivo
```

---

## Variables de entorno

**Backend** (`.env` en `Backend/`, no commitear):

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | `mysql+pymysql://user:pass@host/burgers` |
| `JWT_SECRET_KEY` | Firma de tokens staff (admin/repartidor) |
| `CORS_ORIGINS` | Orígenes del front, coma-separados (incluir puerto de Vite) |

Ver `Backend/.env.example` (plantilla; no commitear `.env` real).

**Frontend**: `VITE_API_URL` opcional; si está vacío se usa **`/api`** (proxy en desarrollo).

---

## Base de datos (MySQL)

- Esquema base: `Database/burgers_schema.sql` (incluye `staff` con `usuario`, `pedido.id_repartidor` → `staff.id`).
- Migraciones sueltas en `Database/`, entre otras: `add_pedido_id_repartidor.sql`, `add_estado_en_camino.sql`, `add_token_seguimiento_pedido.sql`, `add_estado_pendiente_confirmacion_mp.sql` (estado MP pendiente de confirmación), `pedido_estado_a_varchar.sql` (si la columna `estado` pasó de enum a `VARCHAR` para flexibilidad con estados nuevos).
- Script Python idempotente: `Backend/scripts/add_pedido_id_repartidor.py` (columna + FK si faltan).
- Seed SQL de usuarios: `Database/seed_staff.sql` (admin + repartidores con hashes pbkdf2).

**Staff**: `usuario` (login único), `password_hash`, `role` = `admin` | `repartidor`, `is_active`.

**Pedido**: flujo típico `PENDIENTE` → `EN_PREPARACION` → `LISTO` → `EN_CAMINO` → `ENTREGADO` (o `CANCELADO`). Puede existir **`PENDIENTE_CONFIRMACION_MP`** cuando el pago es Mercado Pago y falta confirmar; ese estado se asigna al crear el pedido y se resuelve desde el panel (no aparece como opción manual en el `<select>` de estado del admin: ver `ESTADOS_ADMIN_OPCIONES` en `pedidoEstados.js`). En **`EN_CAMINO`** debe existir **`id_repartidor`**. Campos `referencia`, `notas`, `medio_pago`, token de seguimiento, etc.

**Orden de lista en admin/repartidor (FIFO “cocina”)**: en `Backend/crud/pedido.py`, la query ordena por `created_at` ascendente, pero MySQL no soporta `NULLS LAST`; se usa `order_by(asc(created_at.is_(None)), asc(created_at), asc(id_pedido))` para que los pedidos sin fecha queden al final y el resto salga en orden de llegada.

---

## Autenticación (staff)

- **No** API keys: login con **usuario + contraseña** → `POST /auth/login` → JWT (`Authorization: Bearer …`).
- **Admin**: rutas bajo `/admin/*` con `require_admin`.
- **Repartidor**: rutas bajo `/repartidor/*` con `require_repartidor`.
- Front: componente **`StaffGate`** guarda el JWT en `sessionStorage` y puede validar `expectedRole` (`admin` / `repartidor`).

---

## API (resumen)

| Método | Ruta | Notas |
|--------|------|--------|
| GET | `/productos/` | Catálogo |
| POST | `/pedidos/` | JSON o `multipart` (`pedido` JSON + comprobante MP opcional) |
| GET | `/pedidos/seguimiento/{token}` | Público |
| POST | `/auth/login` | `{ usuario, password }` → token + role |
| GET | `/admin/pedidos` | Lista todos los pedidos |
| GET | `/admin/repartidores` | Staff `role=repartidor` |
| PATCH | `/admin/pedidos/{id}` | Body `PedidoEstadoPatch`: si `estado=EN_CAMINO` → `id_repartidor` obligatorio |
| GET | `/repartidor/pedidos` | Solo `EN_CAMINO` asignados al staff logueado |
| POST | `/repartidor/pedidos/{id}/entregado` | Marca entregado si el pedido es de ese repartidor |

Estáticos: `/media/productos/...` para imágenes de productos subidas al servidor.

---

## Frontend — rutas

| Ruta | Página |
|------|--------|
| `/` | Home / menú |
| `/pedido` | Carrito + datos de entrega + medio de pago |
| `/seguimiento`, `/seguimiento/:token` | Estado del pedido |
| `/admin` | Panel cocina: **Activos** vs **Historial** (tabs), cards por pedido, modal de detalle (ítems, referencia, notas, notas MP si aplica) |
| `/repartidor` | Lista de pedidos EN_CAMINO propios + marcar entregado |

**Diseño / marca**: variables CSS `--lbv-*` en `App.css` (naranja, celeste/cyan, crema, ink). Combos con layout horizontal + imágenes en `public/img/combos/` mapeadas en `src/data/comboProductImages.js`.

**Admin (UI de cards)** — `Frontend/Burgers/src/pages/Admin/AdminPage.jsx` + `AdminPage.css`:

- Cada pedido es una **card** con pie: selects **Repartidor** y **Estado** (labels con clase `.admin-order-field-label`), más acciones Mercado Pago cuando corresponde.
- Contacto: enlace **WhatsApp** (`wa.me` + número normalizado), estilo botón verde (`.admin-order-wa`), ícono SVG `IconWhatsapp` (`.admin-order-wa-icon`); tipografía del panel en **DM Sans** (override de headings en `.admin-page`).
- Asset opcional: `public/img/mercadopago-wordmark.svg` para branding MP en el panel.

---

## Flujo operativo resumido

1. Cliente arma pedido en `/pedido` y envía (FormData con JSON `pedido`).
2. Admin ve pedidos en **activos**, cambia estados; al poner **En la calle** elige **repartidor** (PATCH con `id_repartidor`).
3. Repartidor ve solo sus pedidos **EN_CAMINO** y marca **entregado** → pasa a **historial** en admin (filtro front: `ENTREGADO` / `CANCELADO`).
4. Seguimiento: enlace con `token_seguimiento` devuelto al crear el pedido.

---

## Cómo levantar en local

1. MySQL con base `burgers` (aplicar `burgers_schema.sql` + migraciones si la BD es vieja).
2. Backend: `cd Backend`, venv, `pip install -r requirements.txt`, `.env` con `DATABASE_URL` y `JWT_SECRET_KEY`, `uvicorn main:app --reload --port 8000`.
3. Frontend: `cd Frontend/Burgers`, `npm install`, `npm run dev` (Vite; proxy `/api` → 8000 si no usás `VITE_API_URL` absoluto).

---

## Scripts útiles (Backend)

| Script | Descripción |
|--------|-------------|
| `scripts/seed_admin.py` | Crea admin si no existe (ajusta esquema `staff` viejo) |
| `scripts/seed_repartidor.py` | Crea usuario repartidor de ejemplo |
| `scripts/resync_staff_users.py` | Borra `staff` y recrea admin + repartidor demo |
| `scripts/add_pedido_id_repartidor.py` | Migración columna `id_repartidor` |
| `scripts/gen_pbkdf2.py` | Generar hash manual para SQL |

---

## Archivos de referencia rápida

- Estados y labels UI: `Frontend/Burgers/src/data/pedidoEstados.js` (`ESTADO_PEDIDO_LABEL` incluye `PENDIENTE_CONFIRMACION_MP`; `ESTADOS_ADMIN_OPCIONES` **no**, a propósito).
- Mapa imágenes combos: `Frontend/Burgers/src/data/comboProductImages.js`
- Esquema Pydantic pedido: `Backend/schemas/pedido.py`
- Lógica estados + repartidor + orden FIFO listas: `Backend/crud/pedido.py`
- Panel admin (cards, modal, WA): `Frontend/Burgers/src/pages/Admin/AdminPage.jsx`, `AdminPage.css`

---

## Notas para continuar

- Si algo falla con “Unknown column `pedido.id_repartidor`”, ejecutar `scripts/add_pedido_id_repartidor.py` o el SQL en `Database/add_pedido_id_repartidor.sql`.
- CORS: añadir el origen exacto del front (puerto Vite) en `CORS_ORIGINS`.
- **No** commitear `.env` ni claves; `JWT_SECRET_KEY` fuerte en producción.

---

## Resumen de contexto reciente (desarrollo)

- **Mercado Pago**: pedidos pueden quedar en `PENDIENTE_CONFIRMACION_MP` hasta confirmar desde admin; el select de estado no ofrece ese valor — se usan los botones/flujo dedicados en la card.
- **WhatsApp en card admin**: botón compacto (texto e ícono reducidos), enlace externo a `wa.me`.
- **Labels “Repartidor” / “Estado”**: visibilidad reforzada en `.admin-order-field-label` (tamaño y color de tinta oscura sobre el fondo crema de la card).

*Última actualización: documento ampliado con detalle de admin UI, FIFO en MySQL, estados MP y migraciones; alineado con `main` del repo.*
