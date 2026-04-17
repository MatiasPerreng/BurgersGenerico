import { Link } from "react-router-dom";
import "./Footer.css";
import { businessInfo } from "../../data/businessInfo";

export default function Footer() {
  return (
    <footer className="lbv-footer">
      <div className="lbv-footer__ambient" aria-hidden="true" />
      <div className="lbv-footer-wave" aria-hidden="true" />
      <div className="container lbv-footer__inner py-5 position-relative">
        <div className="row g-4 text-center text-md-start">
          <div className="col-md-4">
            <p className="lbv-footer__brand font-bubble mb-2">Smash Burgers</p>
            <p className="lbv-footer__plain small mb-0">{businessInfo.slogan}</p>
          </div>
          <div className="col-md-4">
            <p className="lbv-footer__plain small mb-1">{businessInfo.locationLabel}</p>
            <p className="lbv-footer__plain small mb-1">{businessInfo.postalLine}</p>
            <p className="lbv-footer__plain small mb-1">{businessInfo.servicesLine}</p>
            <p className="lbv-footer__plain small mb-0">
              <a href={businessInfo.phoneHref}>{businessInfo.phoneDisplay}</a>
            </p>
          </div>
          <div className="col-md-4">
            <p className="lbv-footer__plain small mb-1">{businessInfo.coverage}</p>
            <p className="lbv-footer__plain small mb-0">
              <a href={businessInfo.instagramUrl} target="_blank" rel="noopener noreferrer">
                Instagram {businessInfo.instagramHandle}
              </a>
            </p>
          </div>
        </div>
        <div className="row g-3 align-items-center mt-4 pt-4 lbv-footer__bottom">
          <div className="col-12 col-md-6 text-center text-md-start small">
            <Link to="/admin" className="lbv-footer__plain-link">
              Administración
            </Link>
            <span className="lbv-footer__sep mx-2" aria-hidden="true">
              ·
            </span>
            <Link to="/repartidor" className="lbv-footer__plain-link">
              Repartidor
            </Link>
          </div>
          <div className="col-12 col-md-6 text-center text-md-end small lbv-footer__credit">
            <span className="lbv-footer__credit-developed">DEVELOPED BY</span>{" "}
            <span className="lbv-footer__credit-brand">INFOCORE SOLUTIONS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
