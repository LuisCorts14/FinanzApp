import { Link } from "react-router-dom";

interface BrandLogoProps {
  to?: string;
  inverted?: boolean;
  hideNameOnMobile?: boolean;
}

export default function BrandLogo({ to = "/", inverted = false, hideNameOnMobile = false }: BrandLogoProps) {
  return (
    <Link to={to} className={`brand-logo${inverted ? " brand-logo-inverted" : ""}`}>
      <span className="brand-mark">F</span>
      <span className={`brand-name${hideNameOnMobile ? " brand-name-collapsible" : ""}`}>FinanzApp</span>
    </Link>
  );
}
