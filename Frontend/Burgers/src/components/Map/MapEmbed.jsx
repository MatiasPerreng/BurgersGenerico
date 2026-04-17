import "./MapEmbed.css";
import { businessInfo, mapEmbedSrc } from "../../data/businessInfo";

export default function MapEmbed() {
  return (
    <div className="lbv-map-wrapper">
      <div className="lbv-map-header">
        <h3 className="lbv-map-title">¿Dónde estamos?</h3>
        <p className="lbv-map-address">
          <span className="lbv-map-pin" aria-hidden>
            📍
          </span>
          {businessInfo.streetAddress}, {businessInfo.area}
        </p>
        <p className="lbv-map-address-secondary mb-0">{businessInfo.postalLine}</p>
        <p className="lbv-map-coverage mb-0">{businessInfo.coverage}</p>
      </div>
      <div className="lbv-map-container">
        <iframe
          title="Ubicación La Buena Vida Burgers"
          src={mapEmbedSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <p className="lbv-map-footer-link mb-0">
        <a href={businessInfo.mapsShareUrl} target="_blank" rel="noopener noreferrer">
          Abrir en Google Maps
        </a>
      </p>
    </div>
  );
}
