import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { listAccounts } from "../api/accounts";
import { downloadMovementsCsv } from "../api/settings";
import type { Account } from "../api/types";
import { useSettings } from "../context/settingsContext";
import { formatShortDate } from "../utils/format";
import { nextPayday } from "../utils/payday";
import { toISODate } from "../utils/savings";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const ALERT_OPTIONS = [60, 70, 75, 80, 85, 90, 95];

export default function SettingsPage() {
  const { settings, loaded, update } = useSettings();
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [payday, setPayday] = useState("");
  const [savingsTarget, setSavingsTarget] = useState(20);
  const [alertPct, setAlertPct] = useState(80);
  const [defaultAccount, setDefaultAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  // Cuando llega la configuración guardada, se copia al formulario.
  useEffect(() => {
    if (!loaded) return;
    setPayday(settings.payday ? String(settings.payday) : "");
    setSavingsTarget(settings.savings_target_pct);
    setAlertPct(settings.budget_alert_pct);
    setDefaultAccount(settings.default_account_id ? String(settings.default_account_id) : "");
  }, [loaded, settings]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await update({
        payday: payday ? Number(payday) : null,
        savings_target_pct: savingsTarget,
        budget_alert_pct: alertPct,
        default_account_id: defaultAccount ? Number(defaultAccount) : null,
      });
      setNotice({ kind: "ok", text: "Configuración guardada." });
    } catch {
      setNotice({ kind: "error", text: "No se pudo guardar la configuración." });
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadMovementsCsv();
    } catch {
      setNotice({ kind: "error", text: "No se pudo descargar el archivo." });
    } finally {
      setExporting(false);
    }
  }

  const needs = 50;
  const wants = Math.max(100 - needs - savingsTarget, 0);
  const nextPay = payday ? nextPayday(Number(payday)) : null;

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Ajusta la app a cómo manejas tu plata</p>
          <h1>Configuración</h1>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <section className="card settings-section">
          <div className="settings-row">
            <div className="settings-text">
              <h2>Día de pago</h2>
              <p>
                El día del mes en que recibes tu sueldo. Con esto el Dashboard te dice cuánto puedes gastar por día
                hasta el próximo pago.
              </p>
            </div>
            <div className="settings-control">
              <select value={payday} onChange={(e) => setPayday(e.target.value)} aria-label="Día de pago">
                <option value="">No lo sé / variable</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    Día {d}
                  </option>
                ))}
              </select>
              {nextPay && <span className="field-hint">Próximo pago: {formatShortDate(toISODate(nextPay))}</span>}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-text">
              <h2>Meta de ahorro mensual</h2>
              <p>
                Qué parte de tus ingresos quieres guardar cada mes. Una guía común es la regla 50/30/20: 50% para lo
                necesario, 30% para gustos y 20% para ahorrar.
              </p>
            </div>
            <div className="settings-control">
              <div className="range-row">
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={savingsTarget}
                  onChange={(e) => setSavingsTarget(Number(e.target.value))}
                  aria-label="Meta de ahorro en porcentaje"
                />
                <strong className="range-value">{savingsTarget}%</strong>
              </div>
              <div className="split-bar" aria-hidden="true">
                <span className="split-needs" style={{ flexBasis: `${needs}%` }}>
                  {needs}%
                </span>
                {wants > 0 && (
                  <span className="split-wants" style={{ flexBasis: `${wants}%` }}>
                    {wants}%
                  </span>
                )}
                {savingsTarget > 0 && (
                  <span className="split-savings" style={{ flexBasis: `${savingsTarget}%` }}>
                    {savingsTarget}%
                  </span>
                )}
              </div>
              <span className="field-hint">
                Necesario {needs}% · Gustos {wants}% · Ahorro {savingsTarget}%
              </span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-text">
              <h2>Aviso de presupuesto</h2>
              <p>
                Cuando gastes este porcentaje de un presupuesto, la categoría se marca en amarillo para que te frenes a
                tiempo.
              </p>
            </div>
            <div className="settings-control">
              <select
                value={alertPct}
                onChange={(e) => setAlertPct(Number(e.target.value))}
                aria-label="Aviso de presupuesto"
              >
                {ALERT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    Al llegar al {p}%
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-text">
              <h2>Cuenta predeterminada</h2>
              <p>La que aparece seleccionada al registrar una transacción o escanear una boleta.</p>
            </div>
            <div className="settings-control">
              <select
                value={defaultAccount}
                onChange={(e) => setDefaultAccount(e.target.value)}
                aria-label="Cuenta predeterminada"
              >
                <option value="">La primera de mi lista</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-footer">
            {notice && <p className={notice.kind === "ok" ? "form-success" : "error"}>{notice.text}</p>}
            <button type="submit" disabled={saving || !loaded}>
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </section>
      </form>

      <section className="card settings-section">
        <div className="settings-row">
          <div className="settings-text">
            <h2>Exportar mis datos</h2>
            <p>
              Descarga todas tus transacciones y transferencias en un archivo CSV que puedes abrir en Excel o Google
              Sheets. Tus datos son tuyos.
            </p>
          </div>
          <div className="settings-control">
            <button type="button" className="button-secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? "Preparando..." : "Descargar CSV"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
