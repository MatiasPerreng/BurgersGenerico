const raw = import.meta.env.VITE_API_URL;

/**
 * Valor crudo de configuración (.env).
 * - Sin definir o vacío: `/api` (intención: proxy de Vite en dev).
 * - URL absoluta: el backend **no** usa prefijo `/api`; si la variable termina en `/api`, lo quitamos.
 */
function readEnvApiBase() {
  if (raw === undefined || raw === "") return "/api";
  const s = String(raw).trim();
  if (!s || s === "undefined" || s === "null") return "/api";
  let base = s.replace(/\/+$/, "");
  if (!base) return "/api";
  if (/^https?:\/\//i.test(base) && /\/api$/i.test(base)) {
    base = base.replace(/\/api$/i, "");
  }
  return base;
}

const envApiBase = readEnvApiBase();

function effectivePort(u) {
  if (u.port) return u.port;
  return u.protocol === "https:" ? "443" : "80";
}

/** True si la URL del .env es el mismo origen que la página (típico error: apuntar al Vite en vez del API). */
function envPointsToCurrentDevServer(absUrl) {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(absUrl);
    const loc = window.location;
    return (
      u.hostname === loc.hostname &&
      effectivePort(u) === effectivePort(loc)
    );
  } catch {
    return false;
  }
}

/**
 * Base URL del backend para `fetch` e imágenes `/media/*`.
 * - Sin URL absoluta en .env: usamos `/api` (proxy en `vite.config.js` → uvicorn en 127.0.0.1:8000).
 *   Así el navegador solo habla con el mismo origen que Vite (p. ej. :5174); no hace falta abrir el
 *   puerto 8000 al firewall ni exponerlo en la red.
 * - Si `VITE_API_URL` es absoluta pero apunta al mismo origen que el front (error típico), se fuerza `/api`.
 * - En despliegues sin proxy delante del front, definí `VITE_API_URL` con la URL real del API.
 */
export function getApiBase() {
  if (typeof envApiBase === "string" && /^https?:\/\//i.test(envApiBase)) {
    let b = envApiBase.replace(/\/+$/, "");
    if (typeof window !== "undefined" && envPointsToCurrentDevServer(b)) {
      if (import.meta.env.DEV) {
        console.warn(
          "[api] VITE_API_URL apunta al mismo origen que el front. Usando el prefijo /api (proxy de Vite).",
        );
      }
      return "/api";
    }
    return b;
  }
  if (envApiBase === "/api" && typeof window !== "undefined") {
    return "/api";
  }
  return envApiBase;
}

const apiBase = getApiBase();

export default apiBase;

/** POST /pedidos/form — se calcula en cada envío por si el entorno cambia. */
export function urlPedidoFormCrear() {
  return `${String(getApiBase()).replace(/\/+$/, "")}/pedidos/form`;
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  const shown = raw === undefined || raw === "" ? "(vacío)" : String(raw);
  console.info(`[api] VITE_API_URL=${shown} → base API: ${getApiBase()} (proxy /api → :8000 en dev/preview)`);
}
