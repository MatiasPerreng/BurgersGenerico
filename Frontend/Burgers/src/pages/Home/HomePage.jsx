import { useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import WaveDivider from "../../components/WaveDivider/WaveDivider";
import MapEmbed from "../../components/Map/MapEmbed";
import { MERCADOPAGO_LINK_NEGOCIO } from "../../constants/mercadopagoNegocio";
import "./HomePage.css";

const PRODUCT_DEMO_ITEMS = [
  {
    step: "01",
    tag: "Clásico",
    src: "/img/products/smash-double-1.png",
    title: "Double smash",
    caption: "Doble carne a la plancha, queso derretido y borde crocante.",
    alt: "Hamburguesa doble smash con queso fundido y pan brioche sobre fondo negro.",
  },
  {
    step: "02",
    tag: "Extra",
    src: "/img/products/smash-double-2.png",
    title: "Extra queso",
    caption: "Salsa cheddar cremosa, drip perfecto para los más fiesteros.",
    alt: "Hamburguesa smash con abundante salsa de queso cheddar.",
  },
  {
    step: "03",
    tag: "Full",
    src: "/img/products/smash-double-3.png",
    title: "Full house",
    caption: "Huevo, bacon crocante y cheddar — todo el combo.",
    alt: "Hamburguesa smash con huevo frito, bacon y queso cheddar en pan con sésamo.",
  },
];

export default function HomePage() {
  const promoVideoRef = useRef(null);
  const smashBackdropRef = useRef(null);
  const smashParallaxRef = useRef(null);

  useEffect(() => {
    const el = promoVideoRef.current;
    if (!el) return;
    try {
      el.muted = true;
      const run = el.play();
      if (run !== undefined && typeof run.catch === "function") {
        run.catch(() => {});
      }
    } catch {
      /* autoplay puede fallar según el navegador */
    }
  }, []);

  /**
   * Fondo hero+carta: la foto va anclada al viewport (background-attachment: fixed en CSS) y además
   * movemos background-position con el scroll — sin transform en la misma capa (evita anular el fixed
   * y suma movimiento visible incluso con foto muy blur).
   */
  useLayoutEffect(() => {
    const root = smashBackdropRef.current;
    const layer = smashParallaxRef.current;
    if (!root || !layer) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tick = () => {
      if (mq.matches) {
        layer.style.backgroundPosition = "";
        return;
      }
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const shift = (-rect.top / vh) * 38;
      const py = 48 + Math.max(-32, Math.min(32, shift));
      const pos = `center ${py}%`;
      layer.style.backgroundPosition = `${pos}, ${pos}, ${pos}`;
    };

    tick();
    const opts = { passive: true, capture: true };
    window.addEventListener("scroll", tick, opts);
    document.addEventListener("scroll", tick, opts);
    window.addEventListener("resize", tick, opts);

    return () => {
      window.removeEventListener("scroll", tick, opts);
      document.removeEventListener("scroll", tick, opts);
      window.removeEventListener("resize", tick, opts);
    };
  }, []);

  return (
    <div className="home-page">
      <Navbar />
      <div ref={smashBackdropRef} className="smash-home-backdrop">
        <div ref={smashParallaxRef} className="smash-home-backdrop__parallax" aria-hidden="true" />
        <header className="smash-hero text-center">
          <div className="smash-hero__mesh" aria-hidden="true" />
          <div className="smash-hero__ambient" aria-hidden="true">
            <span className="smash-hero__orb smash-hero__orb--a" />
            <span className="smash-hero__orb smash-hero__orb--b" />
            <span className="smash-hero__orb smash-hero__orb--c" />
          </div>
          <div className="smash-hero__noise" aria-hidden="true" />
          <div className="smash-hero__grill" aria-hidden="true" />
          <div className="smash-hero__vignette" aria-hidden="true" />
          <div className="container py-4 py-lg-5 position-relative">
            <p className="smash-hero__kicker mb-3">
              <span className="smash-hero__kicker-dot" aria-hidden="true" />
              Pedidos online · Demo
            </p>
            <h1 className="smash-hero__title display-font mb-2">
              <span className="smash-hero__title-smash">Smash</span>
              <span className="smash-hero__title-burgers">
                Burgers
                <span className="smash-hero__title-underline" aria-hidden="true" />
              </span>
            </h1>
            <p className="smash-hero__sub mb-3">Smash · Doble · Extra queso</p>
            <ul className="smash-hero__chips" aria-label="Destacados">
              <li className="smash-hero__chip">Plancha caliente</li>
              <li className="smash-hero__chip">Pan brioche</li>
              <li className="smash-hero__chip">Salsa house</li>
            </ul>
          </div>
          <p className="smash-hero__lead mb-4">
            Elegí tus burgers, sumá cantidades y dejá tu dirección. Flujo de prueba con el look de una
            <br />
            hamburguesería smash: negro, blanco y mucho contraste.
          </p>
          <div className="container position-relative pb-4 pb-lg-5">
            <div className="smash-hero__actions">
              <div className="smash-btn-wrap">
                <Link to="/pedido" className="btn btn-lg smash-btn-primary">
                  <span className="smash-btn-primary__glow" aria-hidden="true" />
                  <span className="smash-btn-primary__shine" aria-hidden="true" />
                  <span className="smash-btn-primary__label">Hacer pedido</span>
                </Link>
              </div>
              <Link to="/seguimiento" className="smash-hero__ghost-link">
                Ver seguimiento
              </Link>
            </div>
          </div>
        </header>

        <div className="smash-home-backdrop__blend" aria-hidden="true" />

        <section
          className="smash-products home-section home-section--products"
          aria-labelledby="smash-products-heading"
        >
          <div className="smash-products__ambient" aria-hidden="true" />
          <div className="container position-relative">
            <header className="smash-products__head text-center mb-4 mb-lg-5">
              <p className="smash-products__eyebrow">
                <span className="smash-products__eyebrow-pill">Carta demo</span>
              </p>
              <h2 id="smash-products-heading" className="smash-products__title">
                Hechos en plancha
              </h2>
              <p className="smash-products__lead col-lg-8 mx-auto mb-0">
                Tres referencias para mostrar el look and feel: fondo oscuro, foco en el producto y
                contraste fuerte, como en el local.
              </p>
            </header>
            <div className="row g-4 g-lg-4 justify-content-center">
              {PRODUCT_DEMO_ITEMS.map((item) => (
                <div key={item.src} className="col-md-6 col-xl-4">
                  <article className="smash-products__card h-100">
                    <div className="smash-products__card-sheen" aria-hidden="true" />
                    <div className="smash-products__card-inner">
                      <span className="smash-products__step" aria-hidden="true">
                        {item.step}
                      </span>
                      <span className="smash-products__tag">{item.tag}</span>
                      <div className="smash-products__media">
                        <img
                          className="smash-products__img"
                          src={item.src}
                          alt={item.alt}
                          width={800}
                          height={600}
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="smash-products__scrim" aria-hidden="true" />
                        <div className="smash-products__media-bar">
                          <h3 className="smash-products__name">{item.title}</h3>
                        </div>
                      </div>
                      <div className="smash-products__body">
                        <span className="smash-products__body-line" aria-hidden="true" />
                        <p className="smash-products__text">{item.caption}</p>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
            <div className="text-center mt-4 mt-lg-5">
              <Link to="/pedido" className="btn btn-lg smash-products__cta">
                Pedir ahora
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section
        className="py-5 lbv-features-section smash-section smash-section--features home-section home-section--features"
        aria-labelledby="smash-features-heading"
      >
        <div className="smash-section__bg" aria-hidden="true" />
        <div className="container position-relative">
          <header className="lbv-section-head text-center mb-4 mb-lg-5">
            <p className="lbv-section-eyebrow">
              <span className="lbv-section-eyebrow-pill">Flujo simple</span>
            </p>
            <h2 id="smash-features-heading" className="lbv-section-title-pro">
              Cómo funciona
            </h2>
          </header>
          <div className="row g-4 g-lg-4 justify-content-center">
            <div className="col-md-6 col-xl-4">
              <article className="lbv-feature-card h-100">
                <span className="lbv-feature-step" aria-hidden>
                  01
                </span>
                <div className="lbv-feature-icon-wrap">
                  <div className="lbv-feature-icon lbv-feature-icon--phone" aria-hidden />
                </div>
                <h3 className="lbv-feature-heading">Seguimiento con tu teléfono</h3>
                <p className="lbv-feature-text">
                  Con el mismo número que usás al pedir ves todos tus pedidos: preparación, listo o en
                  camino — sin códigos ni llamadas.
                </p>
              </article>
            </div>
            <div className="col-md-6 col-xl-4">
              <article className="lbv-feature-card h-100">
                <span className="lbv-feature-step" aria-hidden>
                  02
                </span>
                <div className="lbv-feature-icon-wrap">
                  <div className="lbv-feature-icon lbv-feature-icon--delivery" aria-hidden />
                </div>
                <h3 className="lbv-feature-heading">Cocina y reparto</h3>
                <p className="lbv-feature-text">
                  Armamos tu pedido en cocina; cuando sale a domicilio ves que va en camino hasta tu
                  dirección.
                </p>
              </article>
            </div>
            <div className="col-md-6 col-xl-4">
              <article className="lbv-feature-card lbv-feature-card--pago h-100">
                <span className="lbv-feature-step" aria-hidden>
                  03
                </span>
                <div className="lbv-feature-mp-brand">
                  {MERCADOPAGO_LINK_NEGOCIO ? (
                    <a
                      className="lbv-mp-wordmark-link"
                      href={MERCADOPAGO_LINK_NEGOCIO}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir link de pago Mercado Pago del negocio"
                    >
                      <img
                        className="lbv-mp-wordmark"
                        src="/img/mercadopago-logo.png"
                        alt="Mercado Pago"
                        width={168}
                        height={47}
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <span className="lbv-mp-wordmark-link lbv-mp-wordmark-link--static">
                      <img
                        className="lbv-mp-wordmark"
                        src="/img/mercadopago-logo.png"
                        alt="Mercado Pago"
                        width={168}
                        height={47}
                        loading="lazy"
                      />
                    </span>
                  )}
                </div>
                <h3 className="lbv-feature-heading">Pago y entrega</h3>
                <p className="lbv-feature-text lbv-feature-text--pago">
                  Elegís <strong>efectivo</strong>, <strong>débito</strong> o{" "}
                  <strong className="lbv-mp-name">Mercado Pago</strong>. Con MP el checkout se abre al
                  confirmar y el pago queda asociado al pedido automáticamente. Cargás contacto y
                  dirección en el mismo formulario.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-5 lbv-promo-section home-section home-section--promo"
        aria-labelledby="smash-promo-heading"
      >
        <div className="lbv-promo-showcase lbv-promo-showcase--pro">
          <div className="lbv-promo-showcase__glow" aria-hidden="true" />
          <div className="lbv-promo-showcase__mesh" aria-hidden="true" />
          <div className="container position-relative">
            <header className="lbv-promo-head text-center mb-4">
              <p className="lbv-promo-eyebrow">
                <span className="lbv-promo-eyebrow-pill">En vivo</span>
              </p>
              <h2 id="smash-promo-heading" className="lbv-promo-title-pro">
                A la plancha
                <span className="lbv-promo-title-pro__sub">sin vueltas</span>
              </h2>
            </header>
            <div className="lbv-promo-layout">
              <aside className="lbv-promo-aside lbv-promo-aside--left" aria-hidden="true">
                <span className="lbv-promo-badge">SMASH</span>
                <span className="lbv-promo-badge lbv-promo-badge--outline">DOUBLE</span>
              </aside>
              <div className="lbv-promo-video-shell">
                <div className="lbv-promo-video-frame">
                  <div className="lbv-promo-video-frame__ring" aria-hidden="true" />
                  <video
                    ref={promoVideoRef}
                    className="lbv-promo-video"
                    src="/videos/lbv-valientes.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    Tu navegador no reproduce video HTML5.
                  </video>
                </div>
              </div>
              <aside className="lbv-promo-aside lbv-promo-aside--right" aria-hidden="true">
                <span className="lbv-promo-badge lbv-promo-badge--outline">CRISPY</span>
                <span className="lbv-promo-badge">HOT</span>
              </aside>
            </div>
            <div
              className="lbv-promo-badges-mobile d-flex d-md-none justify-content-center gap-2 flex-wrap mt-2"
              aria-hidden="true"
            >
              <span className="lbv-promo-badge">SMASH</span>
              <span className="lbv-promo-badge lbv-promo-badge--outline">DOUBLE</span>
              <span className="lbv-promo-badge lbv-promo-badge--outline">CRISPY</span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="smash-mp-strip home-section home-section--mp"
        aria-labelledby="smash-mp-strip-heading"
      >
        <WaveDivider className="lbv-wave-wrap--to-dark smash-mp-strip__lead-wave" />
        <div className="smash-mp-strip__noise" aria-hidden="true" />
        <div className="container py-5 position-relative">
          <div className="row g-4 g-lg-5 align-items-start">
            <div className="col-lg-4 text-center text-lg-start">
              <p className="smash-mp-strip__kicker">Pago online</p>
              <h2 id="smash-mp-strip-heading" className="smash-mp-strip__title">
                ¿Sabías que podés pagar con Mercado Pago?
              </h2>
              {MERCADOPAGO_LINK_NEGOCIO ? (
                <a
                  href={MERCADOPAGO_LINK_NEGOCIO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="smash-mp-strip__logo-link d-inline-block mx-auto mx-lg-0"
                  aria-label="Abrir link de pago Mercado Pago"
                >
                  <img
                    className="smash-mp-strip__logo-img"
                    src="/img/mercadopago-logo.png"
                    alt="Mercado Pago"
                    width={200}
                    height={56}
                    loading="lazy"
                    decoding="async"
                  />
                </a>
              ) : (
                <img
                  className="smash-mp-strip__logo-img d-block mx-auto mx-lg-0"
                  src="/img/mercadopago-logo.png"
                  alt="Mercado Pago"
                  width={200}
                  height={56}
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>
            <div className="col-lg-8">
              <div className="smash-mp-strip__copy">
                <div className="smash-mp-strip__prose">
                  <p className="smash-mp-strip__text">
                    Desde <Link to="/pedido">Hacer pedido</Link> armás el carrito y completás contacto y
                    dirección. En el paso de pago podés elegir <strong>Mercado Pago</strong>: se abre el
                    checkout habitual para pagar con tarjeta, saldo u otra opción de tu cuenta.
                  </p>
                  <p className="smash-mp-strip__text">
                    Cuando el pago se acredita, queda asociado a tu pedido. Podés ver el estado en{" "}
                    <Link to="/seguimiento">Seguimiento</Link> con tu teléfono.
                  </p>
                </div>
                {MERCADOPAGO_LINK_NEGOCIO && (
                  <div className="row g-2 g-md-3 mt-3 smash-mp-strip__meta text-start small">
                    <div className="col-md-6">
                      <a
                        href={MERCADOPAGO_LINK_NEGOCIO}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="smash-mp-strip__meta-link"
                      >
                        Link de pago del local
                      </a>
                    </div>
                    <div className="col-md-6">También disponible desde el flujo al pedir.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <WaveDivider />
      </section>

      <section className="pb-5 lbv-map-section home-section home-section--map" aria-label="Mapa">
        <div className="container">
          <MapEmbed />
        </div>
      </section>

      <Footer />
    </div>
  );
}
