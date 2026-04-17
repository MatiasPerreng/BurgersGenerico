import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import MercadoPagoComprobanteLink from "../../components/MercadoPagoComprobanteLink/MercadoPagoComprobanteLink";
import API_URL, { urlPedidoFormCrear } from "../../services/api";
import {
  MP_BROADCAST_NAME,
  mpPendingCheckoutClear,
  mpPendingCheckoutLoad,
  mpPendingCheckoutMarkExhausted,
  mpPendingCheckoutSave,
  sincronizarPagoMercadoPagoPorPedido,
} from "../../services/mercadopagoSync";
import { imagenComboPorNombre } from "../../data/comboProductImages";
import "./PedidoPage.css";

const initialForm = {
  nombre: "",
  apellido: "",
  telefono: "",
  email: "",
  direccion: "",
  referencia: "",
  notas: "",
  medioPago: "efectivo",
  efectivoNecesitaCambio: false,
  efectivoPagoCon: "",
};

export default function PedidoPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [carrito, setCarrito] = useState({});
  const [form, setForm] = useState(initialForm);
  const [enviando, setEnviando] = useState(false);
  const [pedidoOk, setPedidoOk] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [imgFallidas, setImgFallidas] = useState({});
  /** Tras abrir Checkout en otra pestaña: poll hasta que el backend asocie el pago. */
  const [mpPollingIdPedido, setMpPollingIdPedido] = useState(null);
  /** Si el navegador bloqueó window.open, el usuario abre el checkout con este enlace. */
  const [mpCheckoutUrlFallback, setMpCheckoutUrlFallback] = useState(null);
  /** Se agotó el tiempo de polling sin confirmar el pago (el usuario puede ir a Seguimiento). */
  const [mpPollExhausted, setMpPollExhausted] = useState(false);

  const mpRestoreDoneRef = useRef(false);

  /** Panel lateral: carrito → formulario */
  const [carritoDrawerOpen, setCarritoDrawerOpen] = useState(false);
  const [carritoDrawerPaso, setCarritoDrawerPaso] = useState("carrito");

  /** Recuperar pedido MP pendiente tras F5 o cerrar/abrir la pestaña (sessionStorage, 24 h). */
  useEffect(() => {
    if (mpRestoreDoneRef.current) return;
    mpRestoreDoneRef.current = true;
    const p = mpPendingCheckoutLoad();
    if (!p?.pedidoSnapshot || !p.idPedido) return;
    const snap = p.pedidoSnapshot;
    if (snap.mercadopago_payment_id || snap.mercadopago_referencia) {
      mpPendingCheckoutClear();
      return;
    }
    setPedidoOk(snap);
    if (p.phase === "polling") {
      setMpPollingIdPedido(p.idPedido);
      setMpPollExhausted(false);
    } else if (p.phase === "exhausted") {
      setMpPollExhausted(true);
    }
  }, []);

  /** Otra pestaña (p. ej. retorno de MP en /pedido/pago-resultado) avisó que el pago ya está asociado. */
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel(MP_BROADCAST_NAME);
      bc.onmessage = (ev) => {
        const d = ev.data;
        if (!d || d.type !== "paid" || !d.pedido) return;
        const incoming = d.pedido;
        if (!incoming.mercadopago_payment_id && !incoming.mercadopago_referencia) return;
        setPedidoOk((prev) => {
          if (prev?.id_pedido !== incoming.id_pedido) return prev;
          mpPendingCheckoutClear();
          return incoming;
        });
        setMpPollingIdPedido(null);
        setMpCheckoutUrlFallback(null);
        setMpPollExhausted(false);
      };
    } catch {
      /* navegador sin BroadcastChannel */
    }
    return () => {
      try {
        bc?.close();
      } catch {
        /* */
      }
    };
  }, []);

  const MP_POLL_MS = 4000;
  const MP_POLL_MAX = 150;

  useEffect(() => {
    if (!mpPollingIdPedido) return;
    const idPedido = mpPollingIdPedido;
    let cancelled = false;
    let n = 0;

    const runSync = async () => {
      try {
        const r = await sincronizarPagoMercadoPagoPorPedido(idPedido);
        if (cancelled) return r;
        if (r.ok && r.data?.mercadopago_payment_id) {
          setPedidoOk(r.data);
          setMpPollingIdPedido(null);
          setMpCheckoutUrlFallback(null);
          setMpPollExhausted(false);
          mpPendingCheckoutClear();
        }
        return r;
      } catch {
        return { ok: false };
      }
    };

    const tick = async () => {
      if (cancelled) return;
      n += 1;
      await runSync();
      if (cancelled) return;
      if (n >= MP_POLL_MAX) {
        setMpPollingIdPedido(null);
        setMpPollExhausted(true);
        setPedidoOk((prev) => {
          if (prev && prev.id_pedido === idPedido) {
            mpPendingCheckoutMarkExhausted(prev, idPedido);
          }
          return prev;
        });
      }
    };

    tick();
    const iv = setInterval(tick, MP_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [mpPollingIdPedido]);

  useEffect(() => {
    if (!carritoDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [carritoDrawerOpen]);

  useEffect(() => {
    if (!carritoDrawerOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setCarritoDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [carritoDrawerOpen]);

  useEffect(() => {
    if (!carritoDrawerOpen || carritoDrawerPaso !== "form") return;
    document.querySelector(".pedido-drawer__body")?.scrollTo?.(0, 0);
  }, [carritoDrawerOpen, carritoDrawerPaso]);

  /** Al volver a esta pestaña tras pagar en la otra, una consulta inmediata. */
  useEffect(() => {
    if (!mpPollingIdPedido) return;
    const idPedido = mpPollingIdPedido;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      sincronizarPagoMercadoPagoPorPedido(idPedido).then((r) => {
        if (r.ok && r.data?.mercadopago_payment_id) {
          setPedidoOk(r.data);
          setMpPollingIdPedido(null);
          setMpCheckoutUrlFallback(null);
          setMpPollExhausted(false);
          mpPendingCheckoutClear();
        }
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mpPollingIdPedido]);

  useEffect(() => {
    fetch(`${API_URL}/productos/`)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el menú");
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Respuesta del servidor inválida");
        }
        setProductos(data);
        setError(null);
      })
      .catch((e) =>
        setError(
          e.message ||
            "No se pudo conectar con el menú. Revisá que el backend esté corriendo (puerto 8000) y que el front use el proxy /api o VITE_API_URL."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => {
    let t = 0;
    for (const p of productos) {
      const q = carrito[p.id_producto] || 0;
      t += q * Number(p.precio);
    }
    return Math.round(t * 100) / 100;
  }, [carrito, productos]);

  const cantidadEnCarrito = useMemo(
    () => Object.values(carrito).reduce((a, b) => a + b, 0),
    [carrito]
  );

  const lineasCarrito = useMemo(() => {
    const lines = [];
    for (const p of productos) {
      const q = carrito[p.id_producto] || 0;
      if (q > 0) {
        const sub = Math.round(q * Number(p.precio) * 100) / 100;
        lines.push({ producto: p, cantidad: q, subtotal: sub });
      }
    }
    return lines;
  }, [productos, carrito]);

  /** Mercado Pago: el backend devuelve init_point (Checkout Pro) y se abre en otra pestaña. */
  const mpIrAPagarMp = form.medioPago === "mercadopago";

  const setCantidad = (idProducto, valor) => {
    const n = Math.max(0, Math.min(99, Number(valor) || 0));
    setCarrito((prev) => {
      const next = { ...prev };
      if (n === 0) delete next[idProducto];
      else next[idProducto] = n;
      return next;
    });
  };

  const incrementar = (id) => {
    const actual = carrito[id] || 0;
    setCantidad(id, actual + 1);
  };

  const decrementar = (id) => {
    const actual = carrito[id] || 0;
    setCantidad(id, actual - 1);
  };

  const handleChange = (e) => {
    const { name, type } = e.target;
    const value = type === "checkbox" ? e.target.checked : e.target.value;

    if (name === "medioPago") {
      setForm((f) => ({
        ...f,
        medioPago: value,
        ...(value !== "efectivo" ? { efectivoNecesitaCambio: false, efectivoPagoCon: "" } : {}),
      }));
      return;
    }

    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorEnvio(null);

    const items = Object.entries(carrito)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([id_producto, cantidad]) => ({
        id_producto: Number(id_producto),
        cantidad,
      }));

    if (items.length === 0) {
      setErrorEnvio("Agregá al menos un producto al pedido.");
      return;
    }

    if (!form.nombre.trim() || !form.apellido.trim() || !form.telefono.trim()) {
      setErrorEnvio("Completá nombre, apellido y teléfono.");
      return;
    }

    if (!form.direccion.trim() || form.direccion.trim().length < 5) {
      setErrorEnvio("Ingresá una dirección de entrega (mínimo 5 caracteres).");
      return;
    }

    if (form.medioPago === "efectivo" && form.efectivoNecesitaCambio) {
      const raw = String(form.efectivoPagoCon || "").trim().replace(",", ".");
      const pagoCon = parseFloat(raw);
      if (!Number.isFinite(pagoCon) || pagoCon <= 0) {
        setErrorEnvio('Indicá con cuánto pagás (ej. si el total es $500 y pagás con $1000, escribí "1000").');
        return;
      }
      if (pagoCon + 0.001 < total) {
        setErrorEnvio(
          `El monto tiene que ser al menos el total del pedido ($${total.toFixed(2)}).`
        );
        return;
      }
    }

    const payload = {
      cliente: {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim() ? form.email.trim() : null,
      },
      direccion: form.direccion.trim(),
      referencia: form.referencia.trim() || null,
      notas: form.notas.trim() || null,
      items,
      medio_pago: form.medioPago,
      mercadopago_referencia: null,
      efectivo_necesita_cambio: form.medioPago === "efectivo" ? !!form.efectivoNecesitaCambio : false,
      efectivo_pago_con:
        form.medioPago === "efectivo" && form.efectivoNecesitaCambio
          ? Number(
              String(form.efectivoPagoCon || "")
                .trim()
                .replace(",", ".")
            )
          : null,
    };

    const fd = new FormData();
    fd.append("pedido", JSON.stringify(payload));

    setEnviando(true);
    try {
      const postUrl = urlPedidoFormCrear();
      const res = await fetch(postUrl, {
        method: "POST",
        body: fd,
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { detail: raw?.slice(0, 400) || `Error HTTP ${res.status}` };
      }
      if (!res.ok) {
        const msg = formatearErrorApi(data);
        throw new Error(
          msg || `No se pudo registrar el pedido (${res.status}${res.statusText ? ` ${res.statusText}` : ""}).`
        );
      }
      if (data.mercadopago_init_point) {
        const init = data.mercadopago_init_point;
        const { mercadopago_init_point: _ip, mercadopago_preference_id: _pr, ...rest } = data;
        setPedidoOk(rest);
        setCarrito({});
        setForm(initialForm);
        setMpCheckoutUrlFallback(null);
        setMpPollExhausted(false);
        mpPendingCheckoutSave(rest, data.id_pedido);
        const w = window.open(init, "_blank", "noopener,noreferrer");
        if (!w || w.closed) {
          setMpCheckoutUrlFallback(init);
        }
        setMpPollingIdPedido(data.id_pedido);
        setCarritoDrawerOpen(false);
        setCarritoDrawerPaso("carrito");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      mpPendingCheckoutClear();
      setMpPollExhausted(false);
      setPedidoOk(data);
      setCarrito({});
      setForm(initialForm);
      setCarritoDrawerOpen(false);
      setCarritoDrawerPaso("carrito");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const m = err.message || "Error al enviar";
      setErrorEnvio(
        m === "Failed to fetch"
          ? "No se pudo conectar con el servidor (¿backend en el puerto 8000?). Si entrás por IP en la red, agregá ese origen en CORS_ORIGINS del backend."
          : m
      );
    } finally {
      setEnviando(false);
    }
  };

  const agrupados = useMemo(() => {
    const map = {};
    for (const p of productos) {
      const cat = p.categoria || "otros";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [productos]);

  const categoriasOrdenadas = useMemo(() => {
    const orden = ["combos", "hamburguesa", "acompañamiento", "bebida", "otros"];
    return Object.keys(agrupados).sort((a, b) => {
      const ia = orden.indexOf(a);
      const ib = orden.indexOf(b);
      const pa = ia === -1 ? 100 + a.charCodeAt(0) : ia;
      const pb = ib === -1 ? 100 + b.charCodeAt(0) : ib;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });
  }, [agrupados]);

  return (
    <div className="pedido-page">
      <Navbar
        cart={{
          onOpen: () => {
            setCarritoDrawerOpen(true);
            setCarritoDrawerPaso("carrito");
          },
          cantidad: cantidadEnCarrito,
          total,
          drawerOpen: carritoDrawerOpen,
        }}
      />
      <main className="container-fluid pedido-page__main py-4 py-lg-5">
        <div className="row mb-4">
          <div className="col-12 col-xl-10">
            <h1 className="display-5 display-font lbv-page-title mb-2">Tu pedido</h1>
            <p className="lbv-page-subtitle mb-0">
              Elegí del menú y abrí el carrito para revisar el pedido y completar tus datos.
            </p>
          </div>
        </div>

        {pedidoOk && (
          <div className="lbv-pedido-ok-card mb-4" role="status">
            <div className="lbv-pedido-ok-head">
              <h2 className="lbv-pedido-ok-title">¡Pedido recibido!</h2>
              <span className="lbv-pedido-ok-num">#{pedidoOk.id_pedido}</span>
            </div>
            <div className="lbv-pedido-ok-chips" aria-label="Estado y pago">
              <span className="lbv-pedido-ok-chip">{etiquetaEstadoPedidoOk(pedidoOk.estado)}</span>
              <span className="lbv-pedido-ok-chip lbv-pedido-ok-chip--muted">
                {etiquetaMedioPago(pedidoOk.medio_pago)}
              </span>
            </div>
            {pedidoOk.medio_pago === "efectivo" && pedidoOk.efectivo_necesita_cambio && (
              <p className="lbv-pedido-ok-line">
                Cambio: <strong>${Number(pedidoOk.efectivo_pago_con).toFixed(2)}</strong> · Total{" "}
                <strong>${Number(pedidoOk.total).toFixed(2)}</strong>
              </p>
            )}

            {pedidoOk.medio_pago === "mercadopago" &&
              mpPollingIdPedido &&
              !pedidoOk.mercadopago_payment_id &&
              !mpPollExhausted && (
                <div className="lbv-mp-wait-compact" role="status">
                  <div className="lbv-mp-wait-compact__icon" aria-hidden>
                    <img src="/img/mercadopago-logo.png" alt="" width={72} height={20} />
                  </div>
                  <div className="lbv-mp-wait-compact__body">
                    <p className="lbv-mp-wait-compact__k">Pago en la otra pestaña</p>
                    <p className="lbv-mp-wait-compact__hint">
                      Al terminar, esto se actualiza solo. Podés recargar: el pedido se guarda en este
                      navegador (24 h).
                    </p>
                    {mpCheckoutUrlFallback && (
                      <a
                        className="lbv-mp-open-pay-btn"
                        href={mpCheckoutUrlFallback}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img src="/img/mercadopago-logo.png" alt="" width={88} height={24} />
                        <span>Ir a pagar</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

            {pedidoOk.medio_pago === "mercadopago" &&
              mpPollExhausted &&
              !pedidoOk.mercadopago_payment_id && (
                <div className="lbv-mp-exhaust-compact" role="status">
                  <p className="lbv-mp-exhaust-compact__k">No vimos el pago aún</p>
                  <p className="lbv-mp-exhaust-compact__hint">
                    Si ya pagaste, puede demorar. Usá los botones de abajo o probá más tarde.
                  </p>
                  <button
                    type="button"
                    className="btn lbv-pedido-ok-btn lbv-pedido-ok-btn--ghost btn-sm mt-1"
                    onClick={() => {
                      mpPendingCheckoutClear();
                      setMpPollExhausted(false);
                    }}
                  >
                    Cerrar aviso
                  </button>
                </div>
              )}

            {pedidoOk.medio_pago === "mercadopago" &&
              (pedidoOk.mercadopago_payment_id || pedidoOk.mercadopago_referencia) && (
                <div className="lbv-mp-paid-row">
                  <span className="lbv-mp-paid-row__k">Listo</span>
                  <MercadoPagoComprobanteLink
                    paymentId={pedidoOk.mercadopago_payment_id}
                    referencia={pedidoOk.mercadopago_referencia}
                  />
                </div>
              )}

            <div className="lbv-pedido-ok-actions">
              <Link className="btn lbv-pedido-ok-btn" to="/seguimiento">
                Seguimiento
              </Link>
              {pedidoOk.token_seguimiento && (
                <>
                  <Link
                    className="btn lbv-pedido-ok-btn lbv-pedido-ok-btn--ghost"
                    to={`/seguimiento/${encodeURIComponent(pedidoOk.token_seguimiento)}`}
                  >
                    Enlace directo
                  </Link>
                  <button
                    type="button"
                    className="btn lbv-pedido-ok-btn lbv-pedido-ok-btn--ghost"
                    onClick={() => {
                      const url = `${window.location.origin}/seguimiento/${pedidoOk.token_seguimiento}`;
                      navigator.clipboard.writeText(url).catch(() => {});
                    }}
                  >
                    Copiar enlace
                  </button>
                </>
              )}
            </div>
            <p className="lbv-pedido-ok-foot">
              Tel. <strong>{pedidoOk.cliente_telefono}</strong> · Te escribimos solo si hace falta.
            </p>
          </div>
        )}

        {loading && <p className="lbv-page-subtitle">Cargando menú...</p>}
        {error && <p className="text-danger fw-semibold">{error}</p>}

        {!loading && !error && (
          <>
            <div className="pedido-flow">
            <section
              className="pedido-panel pedido-panel--catalog"
              aria-labelledby="pedido-catalogo-heading"
            >
              <div className="pedido-panel__head">
                <h2 id="pedido-catalogo-heading" className="pedido-panel__title">
                  Menú
                </h2>
                <p className="pedido-panel__lead mb-0">
                  Sumá cantidades en cada producto. El carrito se abre con el botón flotante.
                </p>
              </div>
              {categoriasOrdenadas.map((categoria) => {
                const lista = agrupados[categoria];
                return (
                <section key={categoria} className="lbv-catalog-section">
                  <h2 className="lbv-catalog-section__title">
                    {etiquetaCategoria(categoria)}
                  </h2>
                  <div className="lbv-catalog-grid">
                    {lista.map((p) => {
                      const src = urlImagenProducto(p, imagenComboPorNombre);
                      const mostrarImg = src && !imgFallidas[p.id_producto];
                      return (
                      <article
                        key={p.id_producto}
                        className={`pedido-catalog-card producto-card rounded-4${p.categoria === "combos" ? " producto-card--combo pedido-catalog-card--combo" : ""}${p.categoria === "hamburguesa" ? " producto-card--hamburguesa pedido-catalog-card--burger" : ""}`}
                      >
                        <div className="pedido-catalog-card__media">
                          {mostrarImg ? (
                            <img
                              src={src}
                              alt=""
                              onError={() =>
                                setImgFallidas((prev) => ({ ...prev, [p.id_producto]: true }))
                              }
                            />
                          ) : (
                            <div className="pedido-catalog-card__placeholder" aria-hidden>
                              <span>{p.categoria === "combos" ? "📦" : "🍔"}</span>
                            </div>
                          )}
                        </div>
                        <div className="pedido-catalog-card__body">
                          <h3 className="pedido-catalog-card__title lbv-product-name">
                            {p.nombre}
                          </h3>
                          {p.descripcion && (
                            <p className="pedido-catalog-card__desc lbv-product-desc">
                              {p.descripcion}
                            </p>
                          )}
                          <div className="pedido-catalog-card__footer">
                            <span
                              className={`pedido-catalog-card__price lbv-price${p.categoria === "combos" ? " lbv-price--combo" : ""}`}
                              aria-label="Precio"
                            >
                              ${Number(p.precio).toFixed(2)}
                            </span>
                            <div
                              className="pedido-catalog-card__qty"
                              role="group"
                              aria-label="Cantidad"
                            >
                              <button
                                type="button"
                                className="btn lbv-qty-btn"
                                onClick={() => decrementar(p.id_producto)}
                                aria-label="Quitar uno"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                className="form-control text-center lbv-qty-input"
                                value={carrito[p.id_producto] || 0}
                                onChange={(e) => setCantidad(p.id_producto, e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn lbv-qty-btn"
                                onClick={() => incrementar(p.id_producto)}
                                aria-label="Sumar uno"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                </section>
                );
              })}
            </section>
            </div>

            <div
              className={`pedido-drawer${carritoDrawerOpen ? " is-open" : ""}`}
              aria-hidden={!carritoDrawerOpen}
            >
              <button
                type="button"
                className="pedido-drawer__backdrop"
                aria-label="Cerrar"
                onClick={() => setCarritoDrawerOpen(false)}
              />
              <aside
                className="pedido-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pedido-drawer-title"
              >
                <header className="pedido-drawer__head">
                  <div>
                    <h2 id="pedido-drawer-title" className="pedido-drawer__title">
                      {carritoDrawerPaso === "carrito" ? "Tu carrito" : "Datos de entrega"}
                    </h2>
                    <p className="pedido-drawer__sub mb-0">
                      {carritoDrawerPaso === "carrito"
                        ? "Revisá los ítems antes de continuar."
                        : "Completá los datos para el envío."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pedido-drawer__close"
                    aria-label="Cerrar"
                    onClick={() => setCarritoDrawerOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <div className="pedido-drawer__body">
                  {carritoDrawerPaso === "carrito" ? (
                    <div className="pedido-drawer__cart">
                      {lineasCarrito.length === 0 ? (
                        <p className="pedido-cart-empty mb-0" role="status">
                          Todavía no agregaste productos. Cerrá y elegí cantidades en el menú.
                        </p>
                      ) : (
                        <>
                          <ul className="pedido-cart-lines list-unstyled">
                            {lineasCarrito.map(({ producto, cantidad, subtotal }) => (
                              <li key={producto.id_producto} className="pedido-cart-line">
                                <span className="pedido-cart-line__main">
                                  <span className="pedido-cart-line__name">{producto.nombre}</span>
                                  <span
                                    className="pedido-cart-line__qty"
                                    aria-label={`Cantidad: ${cantidad}`}
                                  >
                                    ×{cantidad}
                                  </span>
                                </span>
                                <span className="pedido-cart-line__sub">${subtotal.toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="pedido-cart-footer">
                            <span className="pedido-cart-footer__meta">{cantidadEnCarrito} ítems</span>
                            <span className="pedido-cart-footer__total" aria-live="polite">
                              Total <strong>${total.toFixed(2)}</strong>
                            </span>
                          </div>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn pedido-drawer__cta w-100 mt-3"
                        disabled={lineasCarrito.length === 0}
                        onClick={() => setCarritoDrawerPaso("form")}
                      >
                        Realizar pedido
                      </button>
                    </div>
                  ) : (
                    <div className="pedido-drawer__form-wrap">
                      <button
                        type="button"
                        className="btn btn-link pedido-drawer__back px-0 mb-3"
                        onClick={() => setCarritoDrawerPaso("carrito")}
                      >
                        ← Volver al carrito
                      </button>
                      <form onSubmit={handleSubmit} noValidate>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small lbv-label">Nombre</label>
                      <input
                        name="nombre"
                        className="form-control form-control-sm lbv-input"
                        value={form.nombre}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small lbv-label">Apellido</label>
                      <input
                        name="apellido"
                        className="form-control form-control-sm lbv-input"
                        value={form.apellido}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small lbv-label">Teléfono</label>
                      <input
                        name="telefono"
                        type="tel"
                        autoComplete="tel"
                        className="form-control form-control-sm lbv-input"
                        value={form.telefono}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small lbv-label">Email (opcional)</label>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        className="form-control form-control-sm lbv-input"
                        value={form.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small lbv-label">Dirección de entrega</label>
                      <textarea
                        name="direccion"
                        rows={2}
                        className="form-control form-control-sm lbv-input lbv-input-textarea-tight"
                        value={form.direccion}
                        onChange={handleChange}
                        required
                        placeholder="Calle, número, barrio"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small lbv-label">Referencia (opcional)</label>
                      <textarea
                        name="referencia"
                        rows={2}
                        className="form-control form-control-sm lbv-input lbv-input-textarea-tight"
                        value={form.referencia}
                        onChange={handleChange}
                        placeholder="Torre, depto., portería..."
                      />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small lbv-label">Notas del pedido (opcional)</label>
                    <textarea
                      name="notas"
                      rows={2}
                      className="form-control form-control-sm lbv-input lbv-input-textarea-tight"
                      value={form.notas}
                      onChange={handleChange}
                      placeholder="Sin cebolla, punto de la carne, etc."
                    />
                  </div>

                  <div className="mb-2 lbv-pago-block">
                    <span className="form-label small lbv-label d-block mb-1">Forma de pago</span>
                    <div className="lbv-pago-list lbv-pago-list--compact">
                      <div className="form-check lbv-pago-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="medioPago"
                          id="pago-efectivo"
                          value="efectivo"
                          checked={form.medioPago === "efectivo"}
                          onChange={handleChange}
                        />
                        <label className="form-check-label small" htmlFor="pago-efectivo">
                          Efectivo
                        </label>
                      </div>
                      <div className="form-check lbv-pago-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="medioPago"
                          id="pago-debito"
                          value="debito"
                          checked={form.medioPago === "debito"}
                          onChange={handleChange}
                        />
                        <label className="form-check-label small" htmlFor="pago-debito">
                          Débito
                        </label>
                      </div>
                      <div className="form-check lbv-pago-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="medioPago"
                          id="pago-mp"
                          value="mercadopago"
                          checked={form.medioPago === "mercadopago"}
                          onChange={handleChange}
                        />
                        <label className="form-check-label small" htmlFor="pago-mp">
                          Mercado Pago
                        </label>
                      </div>
                    </div>
                  </div>

                  {form.medioPago === "efectivo" && (
                    <div className="mb-2 lbv-efectivo-cambio p-3 rounded-3">
                      <div className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="efectivoNecesitaCambio"
                          id="efectivo-necesita-cambio"
                          checked={form.efectivoNecesitaCambio}
                          onChange={handleChange}
                        />
                        <label className="form-check-label small" htmlFor="efectivo-necesita-cambio">
                          ¿Necesitás cambio?
                        </label>
                      </div>
                      {form.efectivoNecesitaCambio && (
                        <div>
                          <label className="form-label small lbv-label" htmlFor="efectivo-pago-con">
                            ¿Con cuánto pagás?
                          </label>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">$</span>
                            <input
                              id="efectivo-pago-con"
                              name="efectivoPagoCon"
                              type="text"
                              inputMode="decimal"
                              className="form-control lbv-input"
                              value={form.efectivoPagoCon}
                              onChange={handleChange}
                              placeholder={`Mínimo el total (${total.toFixed(2)})`}
                              autoComplete="off"
                              aria-describedby="efectivo-pago-ayuda"
                            />
                          </div>
                          <p id="efectivo-pago-ayuda" className="small text-muted mb-0 mt-1">
                            Para que el reparto lleve vuelto. Total del pedido:{" "}
                            <strong>${total.toFixed(2)}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {form.medioPago === "mercadopago" && (
                    <div className="mb-2 lbv-mp-panel lbv-mp-panel--solo-logo py-3 px-3 rounded-3">
                      <div className="lbv-mp-logo-only">
                        <img
                          className="lbv-mp-logo-form mx-auto d-block"
                          src="/img/mercadopago-logo.png"
                          alt="Mercado Pago"
                          width={168}
                          height={47}
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center mb-2 border-top lbv-total-row pt-2">
                    <span className="small lbv-label">Total estimado</span>
                    <span className="fs-4 display-font lbv-total-amount">${total.toFixed(2)}</span>
                  </div>

                  {errorEnvio && (
                    <div className="alert alert-danger py-2 small mb-3" role="alert">
                      {errorEnvio}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn lbv-btn-submit w-100 py-2"
                    disabled={enviando || cantidadEnCarrito === 0}
                  >
                    {enviando
                      ? mpIrAPagarMp
                        ? "Abriendo Mercado Pago..."
                        : "Enviando..."
                      : mpIrAPagarMp
                        ? "Pagar con Mercado Pago"
                        : "Confirmar pedido"}
                  </button>
                      </form>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function formatearErrorApi(data) {
  const d = data?.detail;
  if (!d) return "";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((x) => x.msg || x).join(" · ");
  }
  return String(d);
}

function etiquetaCategoria(cat) {
  const map = {
    combos: "Combos",
    hamburguesa: "Hamburguesas",
    acompañamiento: "Acompañamientos",
    bebida: "Bebidas",
  };
  return map[cat] || cat;
}

function etiquetaMedioPago(medio) {
  const map = {
    efectivo: "Efectivo",
    debito: "Débito",
    mercadopago: "Mercado Pago",
  };
  return map[medio] || medio || "—";
}

/** Etiqueta corta para el cliente (sin códigos técnicos). */
function etiquetaEstadoPedidoOk(estado) {
  if (estado === "PENDIENTE_CONFIRMACION_MP") return "Esperando tu pago";
  const map = {
    PENDIENTE: "Recibido",
    EN_PREPARACION: "En preparación",
    LISTO: "Listo",
    EN_CAMINO: "En camino",
    ENTREGADO: "Entregado",
    CANCELADO: "Cancelado",
  };
  return map[estado] || estado || "—";
}

/**
 * Prioridad: `imagen` en BD → mapa de combos en front → null.
 * Rutas absolutas / http(s) / `/` sirven desde public o media.
 */
function urlImagenProducto(p, comboMap) {
  const fromDb = p?.imagen ? String(p.imagen).trim() : "";
  if (fromDb) {
    if (fromDb.startsWith("http://") || fromDb.startsWith("https://")) return fromDb;
    if (fromDb.startsWith("/")) return fromDb;
    return `${API_URL}/media/productos/${fromDb}`;
  }
  if (p?.categoria === "combos" && p?.nombre && comboMap?.[p.nombre]) {
    return comboMap[p.nombre];
  }
  return null;
}
