import "./WaveDivider.css";

/** Separador ondulado entre secciones (estilo logo LBV). */
export default function WaveDivider({ flip = false, className = "" }) {
  return (
    <div
      className={`lbv-wave-wrap ${flip ? "lbv-wave-wrap--flip" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      <svg
        className="lbv-wave-svg"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="currentColor"
          d="M0,30 C180,55 360,5 540,28 C720,50 900,8 1080,32 C1200,48 1320,38 1440,25 L1440,60 L0,60 Z"
        />
      </svg>
    </div>
  );
}
