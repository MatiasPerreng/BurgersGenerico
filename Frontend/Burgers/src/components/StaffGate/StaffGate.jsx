import { useState } from "react";
import API_URL from "../../services/api";
import "./StaffGate.css";

/**
 * Login con usuario/contraseña contra POST /auth/login.
 * Guarda el JWT en sessionStorage (no en el bundle).
 */
export default function StaffGate({ storageKey, title, subtitle, expectedRole, children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(storageKey) || "");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const login = async (e) => {
    e.preventDefault();
    const u = usuario.trim();
    if (!u || !password) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: u, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail.map((d) => d.msg || d).join(" ")
              : "No se pudo iniciar sesión";
        setError(msg);
        return;
      }
      if (expectedRole && data.role !== expectedRole) {
        setError(
          expectedRole === "admin"
            ? "Esta cuenta no es de administración."
            : "Esta cuenta no es de repartidor.",
        );
        return;
      }
      sessionStorage.setItem(storageKey, data.access_token);
      setToken(data.access_token);
      setPassword("");
      setUsuario("");
    } catch {
      setError("Error de red. ¿El servidor está en marcha?");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(storageKey);
    setToken("");
  };

  if (!token) {
    return (
      <div className="staff-gate-page">
        <div className="staff-gate-card shadow-sm">
          <h1 className="staff-gate-title display-font">{title}</h1>
          {subtitle && <p className="staff-gate-sub small text-muted mb-3">{subtitle}</p>}
          {error && (
            <div className="alert alert-warning py-2 small mb-3" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={login}>
            <label className="form-label small fw-semibold" htmlFor="staff-user">
              Usuario
            </label>
            <input
              id="staff-user"
              type="text"
              className="form-control staff-gate-input mb-2"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              placeholder="usuario"
            />
            <label className="form-label small fw-semibold" htmlFor="staff-pwd">
              Contraseña
            </label>
            <input
              id="staff-pwd"
              type="password"
              className="form-control staff-gate-input mb-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button type="submit" className="btn staff-gate-btn w-100" disabled={submitting}>
              {submitting ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children({ token, logout })}</>;
}
