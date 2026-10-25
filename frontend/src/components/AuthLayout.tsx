import type { ReactNode } from "react";
import BrandLogo from "./BrandLogo";

const TIPS = [
  "Anotar cada gasto, aunque sea pequeño, es el primer paso para saber a dónde se va tu plata.",
  "Un fondo de emergencia de 3 a 6 meses de gastos te protege de los imprevistos.",
  "La regla 50/30/20: 50% para lo necesario, 30% para gustos y 20% para ahorrar.",
];

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <aside className="auth-panel">
        <BrandLogo inverted />
        <div className="auth-panel-body">
          <h2>Tu dinero, por fin bajo control.</h2>
          <p>Registra lo que ganas y lo que gastas, y aprende a ahorrar con metas que sí puedes cumplir.</p>
          <ul className="auth-tips">
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
        <span className="auth-panel-footer">Hecho para personas, no para expertos en finanzas.</span>
      </aside>

      <main className="auth-main">
        <div className="auth-mobile-brand">
          <BrandLogo />
        </div>
        <div className="auth-form-card">
          <h1>{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
