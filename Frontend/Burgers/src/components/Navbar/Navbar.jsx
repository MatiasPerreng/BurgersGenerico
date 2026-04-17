import { useLayoutEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import "./Navbar.css";

function NavbarCartButton({ cart }) {
  const prevQty = useRef(cart.cantidad);

  const enterFrom = cart.cantidad < prevQty.current ? "left" : "right";

  useLayoutEffect(() => {
    prevQty.current = cart.cantidad;
  }, [cart.cantidad]);

  const qtyKey = cart.cantidad > 0 ? String(cart.cantidad) : "empty";

  return (
    <button
      type="button"
      className="lbv-navbar-cart"
      onClick={cart.onOpen}
      aria-label={
        cart.cantidad > 0
          ? `Carrito: ${cart.cantidad} ítems, total ${cart.total.toFixed(2)} pesos`
          : "Abrir carrito"
      }
      aria-haspopup="dialog"
      aria-expanded={Boolean(cart.drawerOpen)}
    >
      <span className="lbv-navbar-cart__glow" aria-hidden="true" />
      <span
        key={qtyKey}
        className={`lbv-navbar-cart__icon-wrap${cart.cantidad > 0 ? " lbv-navbar-cart__icon-wrap--kick" : ""}`}
      >
        <svg
          className="lbv-navbar-cart__svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"
          />
        </svg>
      </span>
      {cart.cantidad > 0 && (
        <span className="lbv-navbar-cart__badge" aria-hidden>
          <span
            key={cart.cantidad}
            className={`lbv-navbar-cart__digit lbv-navbar-cart__digit--from-${enterFrom}`}
          >
            {cart.cantidad > 99 ? "99+" : cart.cantidad}
          </span>
        </span>
      )}
    </button>
  );
}

export default function Navbar({ cart }) {
  return (
    <nav className="navbar navbar-expand-lg lbv-navbar">
      <div className="lbv-navbar__sheen" aria-hidden="true" />
      <div className="container lbv-navbar-shell py-2 position-relative">
        <Link
          className="navbar-brand lbv-navbar-brand d-flex align-items-center gap-2 gap-md-3"
          to="/"
        >
          <span className="lbv-navbar-mark" aria-hidden="true">
            <span className="lbv-navbar-mark__inner">SB</span>
          </span>
          <span className="lbv-navbar-title">
            <span className="lbv-navbar-name">Smash</span>
            <span className="lbv-navbar-tag">Burgers</span>
          </span>
        </Link>
        <div className="lbv-navbar-toolbar">
          {cart && <NavbarCartButton cart={cart} />}
          <button
            className="navbar-toggler lbv-navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navMain"
            aria-controls="navMain"
            aria-expanded="false"
            aria-label="Abrir menú"
          >
            <span className="navbar-toggler-icon" />
          </button>
        </div>
        <div className="collapse navbar-collapse lbv-navbar-collapse" id="navMain">
          <ul className="navbar-nav ms-lg-auto gap-lg-2 align-items-lg-center">
            <li className="nav-item">
              <NavLink className="nav-link lbv-nav-link" to="/" end>
                Inicio
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link lbv-nav-link" to="/seguimiento">
                Seguimiento
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link lbv-nav-cta" to="/pedido">
                <span className="lbv-nav-cta__shine" aria-hidden="true" />
                <span className="lbv-nav-cta__label">Hacer pedido</span>
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
