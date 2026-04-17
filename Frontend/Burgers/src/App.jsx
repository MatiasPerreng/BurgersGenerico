import { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import AppRouter from "./router/AppRouter";

/**
 * Cursor/VS Code “Simple Browser” y vistas previas embebidas usan marcos cuyo origen no es
 * el mismo que http://127.0.0.1:5174; Chrome puede mostrar chrome-error:// y bloquear la carga.
 * En el navegador normal (misma pestaña) no aplica.
 */
function EmbeddedDevWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      setShow(window.self !== window.top);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className="alert alert-warning border-0 rounded-0 text-center py-2 mb-0 small"
      style={{ position: "relative", zIndex: 1080 }}
      role="status"
    >
      <strong>Vista embebida:</strong> si falla la carga o ves errores de marco (chrome-error), abrí el
      sitio en el navegador:{" "}
      <a href={window.location.href} target="_blank" rel="noopener noreferrer">
        abrir en pestaña nueva
      </a>
      .
    </div>
  );
}

export default function App() {
  return (
    <>
      <EmbeddedDevWarning />
      <AppRouter />
    </>
  );
}
