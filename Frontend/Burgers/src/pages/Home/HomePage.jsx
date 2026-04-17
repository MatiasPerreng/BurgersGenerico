import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import WaveDivider from "../../components/WaveDivider/WaveDivider";
import MapEmbed from "../../components/Map/MapEmbed";
import { MERCADOPAGO_LINK_NEGOCIO } from "../../constants/mercadopagoNegocio";
import "./HomePage.css";

export default function HomePage() {
  const promoVideoRef = useRef(null);

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

  return (
    <div className="home-page">
      <Navbar />
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
          <p className="smash-hero__lead col-lg-7 mx-auto mb-4">
            Elegí tus burgers, sumá cantidades y dejá tu dirección. Flujo de prueba con el look de una
            hamburguesería smash: negro, blanco y mucho contraste.
          </p>
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
        <WaveDivider />
      </header>

      <section
        className="py-5 lbv-features-section smash-section smash-section--features"
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
                  Con el mismo número que usás al pedir ves el estado: preparación, listo o en camino.
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
                  Armamos el pedido; cuando sale a domicilio ves que va en camino hasta tu dirección.
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
                  confirmar y el pago queda asociado al pedido.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 lbv-promo-section" aria-labelledby="smash-promo-heading">
        <div className="lbv-promo-showcase">
          <div className="lbv-promo-showcase__glow" aria-hidden="true" />
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

      <section className="pb-5 lbv-map-section" aria-label="Mapa">
        <div className="container">
          <MapEmbed />
        </div>
      </section>

      <Footer />
    </div>
  );
}
