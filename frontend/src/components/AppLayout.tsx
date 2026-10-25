import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "../utils/user";
import BrandLogo from "./BrandLogo";
import {
  BellIcon,
  ChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DashboardIcon,
  LayersIcon,
  LogoutIcon,
  MenuIcon,
  ScanIcon,
  SearchIcon,
  SettingsIcon,
  TargetIcon,
  TransactionsIcon,
  UserIcon,
  WalletIcon,
} from "./Icons";

const COLLAPSED_STORAGE_KEY = "finanzapp_sidebar_collapsed";

const MAIN_LINKS = [
  { to: "/", label: "Dashboard", icon: DashboardIcon, end: true },
  { to: "/movimientos", label: "Transacciones", icon: TransactionsIcon },
  { to: "/cuentas", label: "Cuentas", icon: WalletIcon },
  { to: "/categories", label: "Categorías", icon: LayersIcon },
  { to: "/estadisticas", label: "Reportes", icon: ChartIcon },
  { to: "/ahorros", label: "Metas de ahorro", icon: TargetIcon },
  { to: "/escanear", label: "Escanear boleta", icon: ScanIcon },
];

const ACCOUNT_LINKS = [{ to: "/perfil", label: "Mi perfil", icon: UserIcon }];

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function SoonItem({ icon: IconComponent, label }: { icon: typeof UserIcon; label: string }) {
  return (
    <span className="sidebar-link sidebar-link-disabled" title={`${label} — próximamente`}>
      <IconComponent />
      <span className="sidebar-link-label">{label}</span>
      <span className="soon-badge">Pronto</span>
    </span>
  );
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Sin storage disponible: el estado vive solo en memoria.
    }
  }, [collapsed]);

  // Cierra el menú móvil al navegar.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/movimientos?q=${encodeURIComponent(q)}` : "/movimientos");
  }

  function toggleMenu() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setMobileOpen((open) => !open);
    } else {
      setCollapsed((c) => !c);
    }
  }

  const displayName = user?.full_name || user?.email || "";

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="icon-button topbar-menu"
            aria-label="Abrir o cerrar menú"
            onClick={toggleMenu}
          >
            <MenuIcon />
          </button>
          <BrandLogo hideNameOnMobile />
        </div>

        <form className="topbar-search" onSubmit={handleSearch} role="search">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar transacciones..."
            aria-label="Buscar transacciones"
          />
        </form>

        <div className="topbar-right">
          <button type="button" className="icon-button" aria-label="Notificaciones (próximamente)" title="Próximamente">
            <BellIcon />
          </button>
          <NavLink to="/perfil" className="avatar" title={`${displayName} · Mi perfil`} aria-label="Mi perfil">
            {getInitials(displayName)}
          </NavLink>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-inner">
          <nav className="sidebar-nav">
            <span className="sidebar-section-title">Menú</span>
            {MAIN_LINKS.map(({ to, label, icon: IconComponent, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                title={collapsed ? label : undefined}
              >
                <IconComponent />
                <span className="sidebar-link-label">{label}</span>
              </NavLink>
            ))}

            <hr className="sidebar-divider" />

            <span className="sidebar-section-title">Cuenta</span>
            {ACCOUNT_LINKS.map(({ to, label, icon: IconComponent }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                title={collapsed ? label : undefined}
              >
                <IconComponent />
                <span className="sidebar-link-label">{label}</span>
              </NavLink>
            ))}
            <SoonItem icon={SettingsIcon} label="Configuración" />
            <button
              type="button"
              className="sidebar-link"
              onClick={handleLogout}
              title={collapsed ? "Cerrar sesión" : undefined}
            >
              <LogoutIcon />
              <span className="sidebar-link-label">Cerrar sesión</span>
            </button>
          </nav>

          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Mostrar menú" : "Esconder menú"}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            <span className="sidebar-link-label">Esconder menú</span>
          </button>
        </div>
      </aside>

      <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />

      <main className="app-main">{children ?? <Outlet />}</main>
    </div>
  );
}
