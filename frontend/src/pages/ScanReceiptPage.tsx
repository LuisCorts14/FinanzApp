import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listAccounts } from "../api/accounts";
import { listCategories } from "../api/categories";
import { getReceiptQuota, scanReceipt } from "../api/receipts";
import type { ReceiptQuota, ReceiptScanResult } from "../api/receipts";
import { createTransaction } from "../api/transactions";
import type { Account, Category } from "../api/types";
import { CloseIcon, PlusIcon, ScanIcon } from "../components/Icons";
import { formatCLP } from "../utils/format";
import { shrinkImage } from "../utils/image";
import { toISODate, todayLocal } from "../utils/savings";

type Step = "pick" | "scanning" | "review" | "saved";

// Un gasto propuesto: la suma de los ítems de una categoría, editable antes de guardar.
interface Row {
  key: number;
  categoryId: string;
  amount: string;
  description: string;
}

function apiErrorDetail(err: unknown): string | undefined {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

let nextKey = 1;

export default function ScanReceiptPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quota, setQuota] = useState<ReceiptQuota | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>("pick");
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(toISODate(todayLocal()));
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([listAccounts(), listCategories(), getReceiptQuota()])
      .then(([accountsData, categoriesData, quotaData]) => {
        setAccounts(accountsData);
        setCategories(categoriesData);
        setQuota(quotaData);
        setAccountId(String(accountsData[0]?.id ?? ""));
      })
      .catch(() => setError("No se pudo conectar con la API."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === "expense"), [categories]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const small = await shrinkImage(file);
      setImage(small);
      setPreviewUrl(URL.createObjectURL(small));
    } catch {
      setError("No pudimos abrir esa imagen. Prueba con una foto en JPG o PNG.");
    }
  }

  async function handleScan() {
    if (!image) return;
    setStep("scanning");
    setError(null);
    try {
      const scanned = await scanReceipt(image);
      setResult(scanned);
      setQuota(scanned.quota);
      if (scanned.date) setDate(scanned.date);
      const merchant = scanned.merchant ?? "Compra";
      setRows(
        scanned.groups.map((g) => ({
          key: nextKey++,
          categoryId: g.category_id ? String(g.category_id) : "",
          amount: String(Math.round(g.amount)),
          description: merchant,
        })),
      );
      setStep("review");
    } catch (err) {
      setError(apiErrorDetail(err) ?? "No se pudo leer la boleta. Intenta de nuevo.");
      setStep("pick");
      getReceiptQuota()
        .then(setQuota)
        .catch(() => undefined);
    }
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey++, categoryId: "", amount: "", description: result?.merchant ?? "Compra" },
    ]);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((r) => r.key !== key));
  }

  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const difference = result?.total != null ? Math.round(result.total - rowsTotal) : 0;
  const allValid = rows.length > 0 && rows.every((r) => r.categoryId && Number(r.amount) > 0);

  function adjustToTotal() {
    if (rows.length === 0 || difference === 0) return;
    const largest = rows.reduce((a, b) => ((Number(b.amount) || 0) > (Number(a.amount) || 0) ? b : a));
    updateRow(largest.key, { amount: String((Number(largest.amount) || 0) + difference) });
  }

  async function handleSave() {
    if (!allValid || !accountId) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        rows.map((r) =>
          createTransaction({
            account_id: Number(accountId),
            category_id: Number(r.categoryId),
            amount: Number(r.amount),
            description: r.description.trim() || null,
            date,
          }),
        ),
      );
      setSavedCount(rows.length);
      setStep("saved");
    } catch {
      setError("No se pudieron guardar todos los gastos. Revisa Transacciones antes de reintentar.");
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setStep("pick");
    setImage(null);
    setPreviewUrl(null);
    setResult(null);
    setRows([]);
    setError(null);
    setDate(toISODate(todayLocal()));
  }

  if (loading) return <div className="page">Cargando...</div>;

  const quotaText = quota?.enabled
    ? `Te quedan ${quota.remaining} de ${quota.limit} escaneos en las próximas 24 horas.`
    : null;

  return (
    <div className="page scan-page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Saca una foto y nosotros anotamos los gastos</p>
          <h1>Escanear boleta</h1>
        </div>
      </div>

      {quota && !quota.enabled && (
        <div className="card onboarding-card">
          <h2>El escaneo no está disponible</h2>
          <p>
            Este servidor no tiene configurada la lectura de boletas. Puedes registrar tus gastos a mano en{" "}
            <Link to="/movimientos">Transacciones</Link>.
          </p>
        </div>
      )}

      {quota?.enabled && accounts.length === 0 && (
        <div className="card onboarding-card">
          <h2>Primero crea una cuenta</h2>
          <p>
            Los gastos de la boleta se anotan en una de tus cuentas. <Link to="/cuentas">Agregar cuenta</Link>
          </p>
        </div>
      )}

      {quota?.enabled && accounts.length > 0 && expenseCategories.length === 0 && (
        <div className="card onboarding-card">
          <h2>Primero crea tus categorías de gasto</h2>
          <p>
            Así podemos repartir cada producto en su categoría (Comida, Hogar, Salud...).{" "}
            <Link to="/categories">Crear categorías</Link>
          </p>
        </div>
      )}

      {error && <p className="error scan-error">{error}</p>}

      {quota?.enabled && accounts.length > 0 && expenseCategories.length > 0 && (
        <>
          {(step === "pick" || step === "scanning") && (
            <section className="card scan-pick">
              {previewUrl ? (
                <div className="scan-preview">
                  <img src={previewUrl} alt="Foto de la boleta" />
                  {step === "scanning" && (
                    <div className="scan-overlay" role="status">
                      <span className="spinner" aria-hidden="true" />
                      <span>Leyendo tu boleta...</span>
                      <span className="scan-overlay-hint">Puede tardar unos segundos</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="scan-dropzone">
                  <span className="scan-dropzone-icon">
                    <ScanIcon />
                  </span>
                  <p className="scan-dropzone-title">Toma una foto de tu boleta</p>
                  <p className="scan-dropzone-hint">
                    Con buena luz, sobre una superficie plana y con el total a la vista.
                  </p>
                </div>
              )}

              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />

              <div className="scan-actions">
                {previewUrl ? (
                  <>
                    <button type="button" className="button-secondary" onClick={restart} disabled={step === "scanning"}>
                      Usar otra foto
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={handleScan}
                      disabled={step === "scanning" || quota.remaining === 0}
                    >
                      <ScanIcon />
                      Leer boleta
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="button-secondary" onClick={() => fileInput.current?.click()}>
                      Subir imagen
                    </button>
                    <button type="button" className="button-primary" onClick={() => cameraInput.current?.click()}>
                      <ScanIcon />
                      Tomar foto
                    </button>
                  </>
                )}
              </div>
              {quotaText && <p className="field-hint scan-quota">{quotaText}</p>}
              <p className="field-hint scan-privacy">La foto se usa solo para leer los datos y no se guarda.</p>
            </section>
          )}

          {step === "review" && result && (
            <div className="scan-review">
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{result.merchant ?? "Boleta"}</h2>
                    <p className="modal-subtitle">
                      {result.items.length} {result.items.length === 1 ? "producto leído" : "productos leídos"}
                    </p>
                  </div>
                  {result.total != null && (
                    <div className="scan-total">
                      <span className="summary-label">Total de la boleta</span>
                      <strong>{formatCLP(result.total)}</strong>
                    </div>
                  )}
                </div>

                <div className="modal-grid">
                  <label>
                    ¿Con qué pagaste?
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fecha
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </label>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <h2>Gastos a registrar</h2>
                  <span className="cell-muted">Agrupados por categoría</span>
                </div>

                <ul className="scan-rows">
                  {rows.map((r) => (
                    <li key={r.key} className={`scan-row${r.categoryId ? "" : " scan-row-missing"}`}>
                      <label>
                        Categoría
                        <select value={r.categoryId} onChange={(e) => updateRow(r.key, { categoryId: e.target.value })}>
                          <option value="">Elige una categoría</option>
                          {expenseCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Monto
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={r.amount}
                          onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                        />
                      </label>
                      <label className="scan-row-description">
                        Descripción
                        <input
                          value={r.description}
                          onChange={(e) => updateRow(r.key, { description: e.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-button icon-button-sm icon-button-danger"
                        aria-label="Quitar este gasto"
                        title="Quitar"
                        onClick={() => removeRow(r.key)}
                      >
                        <CloseIcon />
                      </button>
                    </li>
                  ))}
                </ul>

                <button type="button" className="link-button-muted scan-add-row" onClick={addRow}>
                  <PlusIcon /> Agregar otro gasto
                </button>

                {difference !== 0 && (
                  <div className="scan-mismatch">
                    <span>
                      Los gastos suman <strong>{formatCLP(rowsTotal)}</strong> y la boleta dice{" "}
                      <strong>{formatCLP(result.total ?? 0)}</strong> (diferencia de {formatCLP(Math.abs(difference))}).
                      Puede ser un descuento o un producto que no se leyó bien.
                    </span>
                    {rows.length > 0 && (
                      <button type="button" className="button-secondary button-sm" onClick={adjustToTotal}>
                        Ajustar al total
                      </button>
                    )}
                  </div>
                )}

                <details className="scan-items">
                  <summary>Ver los productos leídos</summary>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Categoría sugerida</th>
                        <th className="align-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.description}</td>
                          <td className="cell-muted">
                            {item.category_id ? categoryName.get(item.category_id) : "Sin categoría"}
                          </td>
                          <td className={`align-right${item.amount < 0 ? " amount-income" : ""}`}>
                            {formatCLP(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>

                <div className="modal-actions">
                  <button type="button" className="button-secondary" onClick={restart}>
                    Descartar
                  </button>
                  <button type="button" onClick={handleSave} disabled={!allValid || saving}>
                    {saving
                      ? "Guardando..."
                      : `Guardar ${rows.length} ${rows.length === 1 ? "gasto" : "gastos"} · ${formatCLP(rowsTotal)}`}
                  </button>
                </div>
                {!allValid && rows.length > 0 && (
                  <p className="field-hint">Elige una categoría y un monto para cada gasto antes de guardar.</p>
                )}
              </section>
            </div>
          )}

          {step === "saved" && (
            <section className="card scan-saved">
              <span className="scan-saved-icon" aria-hidden="true">
                ✓
              </span>
              <h2>
                {savedCount === 1 ? "Guardamos 1 gasto" : `Guardamos ${savedCount} gastos`} por {formatCLP(rowsTotal)}
              </h2>
              <p className="cell-muted">Ya aparecen en tus transacciones, presupuestos y reportes.</p>
              <div className="scan-actions">
                <Link to="/movimientos" className="button-secondary landing-button">
                  Ver transacciones
                </Link>
                <button type="button" className="button-primary" onClick={restart}>
                  <ScanIcon />
                  Escanear otra
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
