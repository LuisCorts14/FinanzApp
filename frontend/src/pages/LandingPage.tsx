import { Link } from "react-router-dom";
import heroPreview from "../assets/hero-preview.png";
import BrandLogo from "../components/BrandLogo";
import { ChartIcon, DashboardIcon, LayersIcon, TargetIcon, TransactionsIcon, WalletIcon } from "../components/Icons";

const FEATURES = [
  {
    icon: DashboardIcon,
    title: "Tu mes de un vistazo",
    text: "Cuánto entró, cuánto salió y cuánto te queda, comparado con el mes anterior.",
  },
  {
    icon: WalletIcon,
    title: "Tus bancos de Chile",
    text: "Elige tu banco, tarjeta o billetera (CuentaRUT, MACH, Tenpo...) y listo.",
  },
  {
    icon: LayersIcon,
    title: "Presupuestos que avisan",
    text: "Ponle un límite a cada gasto y ve en verde, amarillo o rojo cómo vas.",
  },
  {
    icon: TargetIcon,
    title: "Metas con un plan real",
    text: "Te decimos cuánto apartar por día, semana o mes, y si vas al ritmo.",
  },
  {
    icon: ChartIcon,
    title: "Reportes simples",
    text: "Gráficos claros de en qué gastas, sin jerga financiera.",
  },
  {
    icon: TransactionsIcon,
    title: "Registro en segundos",
    text: "Anota un gasto con monto, categoría y listo. Tu saldo se actualiza solo.",
  },
];

const STEPS = [
  { title: "Agrega tus cuentas", text: "Tu banco, tus tarjetas y el efectivo que tienes en la billetera." },
  { title: "Registra tus movimientos", text: "Cada ingreso y cada gasto, con su categoría." },
  { title: "Entiende y mejora", text: "Mira a dónde se va tu plata, ponte límites y ahorra para tus metas." },
];

const TIPS = [
  { title: "Págate primero", text: "Aparta tu ahorro apenas recibes el sueldo, no con lo que sobra a fin de mes." },
  { title: "Fondo de emergencia", text: "Junta de 3 a 6 meses de gastos para que un imprevisto no se vuelva deuda." },
  { title: "La regla 50/30/20", text: "50% para lo necesario, 30% para gustos y 20% para ahorrar." },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <BrandLogo />
        <nav className="landing-nav" aria-label="Secciones">
          <a href="#funciones">Funciones</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>
        <div className="landing-header-actions">
          <Link to="/login" className="landing-login">
            Iniciar sesión
          </Link>
          <Link to="/register" className="landing-button landing-button-primary">
            Crear cuenta
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-text">
          <span className="landing-eyebrow">Finanzas personales, sin complicaciones</span>
          <h1>Tu dinero, por fin bajo control.</h1>
          <p>
            La mayoría de las personas no sabe con certeza en qué se le va la plata cada mes. FinanzApp te ayuda a
            registrar lo que ganas y lo que gastas, ponerte límites y ahorrar para tus metas — sin planillas ni términos
            difíciles.
          </p>
          <div className="landing-cta-row">
            <Link to="/register" className="landing-button landing-button-primary landing-button-lg">
              Crear cuenta gratis
            </Link>
            <Link to="/login" className="landing-button landing-button-secondary landing-button-lg">
              Ya tengo cuenta
            </Link>
          </div>
          <p className="landing-trust">Gratis · En pesos chilenos · Con los bancos de Chile</p>
        </div>

        <div className="landing-hero-image">
          <img src={heroPreview} alt="Dashboard de FinanzApp con ingresos, gastos y balance del mes" />
        </div>
      </section>

      <section id="funciones" className="landing-section">
        <div className="landing-section-header">
          <span className="landing-eyebrow">Funciones</span>
          <h2>Todo lo que necesitas para ordenar tu plata</h2>
        </div>
        <div className="landing-features">
          {FEATURES.map(({ icon: IconComponent, title, text }) => (
            <article key={title} className="landing-feature">
              <span className="landing-feature-icon">
                <IconComponent />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="landing-section">
        <div className="landing-section-header">
          <span className="landing-eyebrow">Cómo funciona</span>
          <h2>Tres pasos para empezar</h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="landing-step">
              <span className="landing-step-number">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section">
        <div className="landing-tips">
          <div className="landing-tips-intro">
            <span className="landing-eyebrow landing-eyebrow-inverted">Aprende mientras usas la app</span>
            <h2>Hábitos simples que hacen la diferencia</h2>
          </div>
          <div className="landing-tips-grid">
            {TIPS.map((tip) => (
              <div key={tip.title} className="landing-tip">
                <h3>{tip.title}</h3>
                <p>{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-final-cta">
        <h2>Empieza hoy a saber a dónde va tu plata</h2>
        <p>Crear tu cuenta toma menos de un minuto.</p>
        <Link to="/register" className="landing-button landing-button-primary landing-button-lg">
          Crear cuenta gratis
        </Link>
      </section>

      <footer className="landing-footer">
        <BrandLogo />
        <span>Proyecto de portafolio · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
