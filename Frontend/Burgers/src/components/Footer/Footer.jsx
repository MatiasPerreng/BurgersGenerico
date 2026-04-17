import { Link } from "react-router-dom";
import "./Footer.css";
import { businessInfo } from "../../data/businessInfo";

export default function Footer() {
  return (
    <footer className="lbv-footer">
      <div className="lbv-footer__ambient" aria-hidden="true" />
      <div className="lbv-footer-wave" aria-hidden="true" />
      <div className="container lbv-footer__content py-5 text-center position-relative">
        <div className="lbv-footer__brand-block mx-auto mb-4">
          <p className="lbv-footer-brand font-bubble mb-0">Smash Burgers</p>
          <span className="lbv-footer__brand-line" aria-hidden="true" />
        </div>
        <p className="lbv-footer-slogan mb-3" aria-label={businessInfo.slogan}>
          <span className="lbv-footer-slogan-pill">{businessInfo.slogan.toUpperCase()}</span>
        </p>
        <p className="lbv-footer-text small mb-1">{businessInfo.locationLabel}</p>
        <p className="lbv-footer-text small mb-2">{businessInfo.postalLine}</p>
        <p className="lbv-footer-text small mb-2">{businessInfo.servicesLine}</p>
        <p className="lbv-footer-text small mb-2">
          <a className="lbv-footer-link" href={businessInfo.phoneHref}>
            {businessInfo.phoneDisplay}
          </a>
        </p>
        <p className="lbv-footer-coverage small mb-3">{businessInfo.coverage}</p>
        <p className="lbv-footer-text small mb-0">
          <a
            className="lbv-footer-link lbv-footer-insta"
            href={businessInfo.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram {businessInfo.instagramHandle}
          </a>
        </p>
        <div className="lbv-footer-staff mt-4 mb-0">
          <Link to="/admin" className="lbv-footer-staff-link">
            Administración
          </Link>
          <span className="lbv-footer-staff-dot" aria-hidden="true">
            ·
          </span>
          <Link to="/repartidor" className="lbv-footer-staff-link">
            Repartidor
          </Link>
        </div>
      </div>
    </footer>
  );
}
