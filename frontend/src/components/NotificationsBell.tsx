import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listNotifications, markNotificationsRead } from "../api/notifications";
import type { AppNotification, NotificationSeverity } from "../api/notifications";
import { BellIcon } from "./Icons";

const SEVERITY_ICON: Record<NotificationSeverity, string> = {
  critical: "!",
  warning: "!",
  info: "i",
  good: "✓",
};

export default function NotificationsBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    listNotifications()
      .then((data) => {
        setItems(data.items);
        setUnread(data.unread_count);
      })
      .catch(() => undefined);
  }, []);

  // Los avisos dependen de los datos: se recalculan al cambiar de página (p. ej. tras registrar un gasto).
  useEffect(() => {
    load();
  }, [load, location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(item: AppNotification) {
    setOpen(false);
    if (!item.read) {
      setItems((current) => current.map((n) => (n.key === item.key ? { ...n, read: true } : n)));
      setUnread((n) => Math.max(n - 1, 0));
      markNotificationsRead([item.key]).catch(() => undefined);
    }
    navigate(item.link);
  }

  async function markAll() {
    setItems((current) => current.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await markNotificationsRead().catch(() => undefined);
  }

  const label = unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones";

  return (
    <div className="notif" ref={wrapper}>
      <button
        type="button"
        className={`icon-button notif-button${open ? " is-open" : ""}`}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {unread > 0 && <span className="notif-count">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notificaciones">
          <div className="notif-header">
            <strong>Notificaciones</strong>
            {unread > 0 && (
              <button type="button" className="link-button-muted" onClick={markAll}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="notif-empty">
              <span className="notif-empty-icon" aria-hidden="true">
                ✓
              </span>
              <p>Todo en orden. Te avisaremos si un presupuesto, una tarjeta o una meta necesita tu atención.</p>
            </div>
          ) : (
            <ul className="notif-list">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`notif-item${item.read ? "" : " is-unread"}`}
                    onClick={() => openItem(item)}
                  >
                    <span className={`notif-icon notif-${item.severity}`} aria-hidden="true">
                      {SEVERITY_ICON[item.severity]}
                    </span>
                    <span className="notif-text">
                      <span className="notif-title">{item.title}</span>
                      <span className="notif-message">{item.message}</span>
                    </span>
                    {!item.read && <span className="notif-dot" aria-label="Sin leer" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
