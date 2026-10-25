import { useEffect, useMemo, useState } from "react";
import { createAccount, updateAccount } from "../api/accounts";
import { listInstitutions } from "../api/catalog";
import type { Institution, InstitutionProduct } from "../api/catalog";
import type { Account, AccountType } from "../api/types";
import { formatMoney } from "../utils/format";
import { ChevronLeftIcon, CloseIcon, SearchIcon, WalletIcon } from "./Icons";
import InstitutionBadge from "./InstitutionBadge";

interface AccountFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  // Con una cuenta, el modal la edita en vez de crear una nueva.
  account?: Account;
}

// Lo que el usuario eligió en el paso 1.
type Choice = { kind: "institution"; institution: Institution } | { kind: "cash" } | { kind: "other" };
type OtherType = Exclude<AccountType, "cash">;

const OTHER_TYPE_LABELS: Record<OtherType, string> = {
  bank: "Cuenta bancaria",
  credit_card: "Tarjeta de crédito",
  savings: "Ahorro o inversión",
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// "La Polar" + "Tarjeta La Polar" -> "Tarjeta La Polar"; "BancoEstado" + "CuentaRUT" -> "BancoEstado · CuentaRUT"
function suggestedName(institution: Institution, product: InstitutionProduct): string {
  const brand = institution.name.replace(/^Banco\s+/, "").split(" ")[0];
  return normalize(product.name).includes(normalize(brand)) ? product.name : `${institution.name} · ${product.name}`;
}

function apiErrorDetail(err: unknown): string | undefined {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

// Paso inicial al editar: cuentas sin institución quedan como "Efectivo" u "Otra".
function initialChoice(account?: Account): Choice | null {
  if (!account || account.institution_id) return null;
  return account.type === "cash" ? { kind: "cash" } : { kind: "other" };
}

export default function AccountFormModal({ onClose, onSaved, account }: AccountFormModalProps) {
  const isEdit = Boolean(account);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [choice, setChoice] = useState<Choice | null>(() => initialChoice(account));
  const [product, setProduct] = useState<InstitutionProduct | null>(null);
  const [otherType, setOtherType] = useState<OtherType>(account && account.type !== "cash" ? account.type : "bank");
  const [name, setName] = useState(account?.name ?? "");
  // Al editar, el nombre que ya eligió la persona no se reemplaza automáticamente.
  const [nameTouched, setNameTouched] = useState(isEdit);
  const [balance, setBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState(account?.credit_limit ? String(account.credit_limit) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listInstitutions()
      .then((list) => {
        setInstitutions(list);
        // Al editar una cuenta con institución, se abre directo en el paso 2 con su producto marcado.
        const inst = account?.institution_id ? list.find((i) => i.id === account.institution_id) : undefined;
        if (inst) {
          setChoice({ kind: "institution", institution: inst });
          setProduct(inst.products.find((p) => p.id === account?.product_id) ?? null);
        }
      })
      .catch(() => setLoadError("No se pudo cargar la lista de instituciones."));
  }, [account]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const grouped = useMemo(() => {
    const q = normalize(search.trim());
    const groups = new Map<string, Institution[]>();
    for (const inst of institutions) {
      const matches =
        !q || normalize(inst.name).includes(q) || inst.products.some((p) => normalize(p.name).includes(q));
      if (!matches) continue;
      groups.set(inst.group, [...(groups.get(inst.group) ?? []), inst]);
    }
    return [...groups.entries()];
  }, [institutions, search]);

  function pickInstitution(institution: Institution) {
    setChoice({ kind: "institution", institution });
    const only = institution.products.length === 1 ? institution.products[0] : null;
    setProduct(only);
    if (!nameTouched) setName(only ? suggestedName(institution, only) : institution.name);
  }

  function pickCash() {
    setChoice({ kind: "cash" });
    setProduct(null);
    if (!nameTouched) setName("Efectivo");
  }

  function pickOther() {
    setChoice({ kind: "other" });
    setProduct(null);
    if (!nameTouched) setName("");
  }

  function pickProduct(institution: Institution, p: InstitutionProduct) {
    setProduct(p);
    if (!nameTouched) setName(suggestedName(institution, p));
  }

  function goBack() {
    setChoice(null);
    setProduct(null);
    setError(null);
  }

  const accountType: AccountType | null =
    choice?.kind === "cash" ? "cash" : choice?.kind === "other" ? otherType : (product?.account_type ?? null);
  const currency = product?.currency ?? account?.currency ?? "CLP";
  const canSubmit = Boolean(choice && name.trim() && accountType);
  const isCard = accountType === "credit_card";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice || !accountType || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    const fields = {
      name: name.trim(),
      type: accountType,
      institution_id: choice.kind === "institution" ? choice.institution.id : null,
      product_id: choice.kind === "institution" ? (product?.id ?? null) : null,
      credit_limit: isCard && Number(creditLimit) > 0 ? Number(creditLimit) : null,
    };
    try {
      if (account) await updateAccount(account.id, fields);
      else await createAccount({ ...fields, currency, balance: Number(balance) || 0 });
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorDetail(err) ?? (isEdit ? "No se pudo guardar la cuenta." : "No se pudo crear la cuenta."));
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit ? "Editar cuenta" : "Nueva cuenta";
  const subtitle = choice
    ? isEdit
      ? "Nombre, institución y producto"
      : "Paso 2 de 2 · Detalles"
    : isEdit
      ? "Elige la institución de esta cuenta"
      : "Paso 1 de 2 · ¿Dónde tienes tu dinero?";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            {choice && (
              <button type="button" className="icon-button" aria-label="Elegir otra institución" onClick={goBack}>
                <ChevronLeftIcon />
              </button>
            )}
            <div>
              <h2 id="account-modal-title">{title}</h2>
              <p className="modal-subtitle">{subtitle}</p>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {!choice && (
          <div className="institution-picker">
            <label className="picker-search">
              <SearchIcon />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busca tu banco, tarjeta o billetera..."
                aria-label="Buscar institución"
                autoFocus
              />
            </label>

            {!search.trim() && (
              <div className="picker-group">
                <div className="institution-grid">
                  <button type="button" className="institution-option" onClick={pickCash}>
                    <span className="institution-badge institution-badge-md institution-badge-cash">
                      <WalletIcon />
                    </span>
                    <span className="institution-option-text">
                      <span className="institution-option-name">Efectivo</span>
                      <span className="institution-option-meta">Billetes y monedas</span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {loadError && <p className="error">{loadError}</p>}

            {grouped.map(([group, items]) => (
              <div key={group} className="picker-group">
                <span className="picker-group-title">{group}</span>
                <div className="institution-grid">
                  {items.map((inst) => (
                    <button
                      key={inst.id}
                      type="button"
                      className="institution-option"
                      onClick={() => pickInstitution(inst)}
                    >
                      <InstitutionBadge name={inst.name} color={inst.color} />
                      <span className="institution-option-text">
                        <span className="institution-option-name">{inst.name}</span>
                        <span className="institution-option-meta">
                          {inst.products.length === 1 ? inst.products[0].name : `${inst.products.length} productos`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {institutions.length > 0 && grouped.length === 0 && (
              <p className="empty-state">No encontramos “{search}”. Puedes agregarla como otra institución.</p>
            )}

            <button type="button" className="link-button-muted picker-other" onClick={pickOther}>
              ¿No está tu institución? Agregar otra
            </button>
          </div>
        )}

        {choice && (
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="selected-institution">
              {choice.kind === "institution" ? (
                <InstitutionBadge name={choice.institution.name} color={choice.institution.color} />
              ) : (
                <span className="institution-badge institution-badge-md institution-badge-cash">
                  <WalletIcon />
                </span>
              )}
              <span className="institution-option-name">
                {choice.kind === "institution"
                  ? choice.institution.name
                  : choice.kind === "cash"
                    ? "Efectivo"
                    : "Otra institución"}
              </span>
              <button type="button" className="link-button-muted selected-institution-change" onClick={goBack}>
                Cambiar
              </button>
            </div>

            {choice.kind === "institution" && (
              <fieldset className="product-fieldset">
                <legend>¿Qué producto es?</legend>
                <div className="product-options">
                  {choice.institution.products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`product-option${product?.id === p.id ? " active" : ""}`}
                      aria-pressed={product?.id === p.id}
                      onClick={() => pickProduct(choice.institution, p)}
                    >
                      {p.name}
                      {p.currency !== "CLP" && <span className="product-currency">{p.currency}</span>}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {choice.kind === "other" && (
              <label>
                Tipo
                <select value={otherType} onChange={(e) => setOtherType(e.target.value as OtherType)}>
                  {Object.entries(OTHER_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Nombre de la cuenta
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                placeholder={choice.kind === "other" ? "Ej. Caja Vecina del barrio" : undefined}
                maxLength={100}
                required
              />
            </label>

            {isEdit ? (
              <div className="field-readonly">
                <span className="field-readonly-label">Saldo actual</span>
                <strong>{account && formatMoney(account.balance, account.currency)}</strong>
                <span className="field-hint">El saldo cambia solo con tus ingresos y gastos.</span>
              </div>
            ) : (
              <label>
                {isCard ? "Saldo actual" : "¿Cuánto tienes hoy?"} ({currency})
                <input
                  type="number"
                  step={currency === "CLP" ? "1" : "0.01"}
                  inputMode="decimal"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0"
                />
                <span className="field-hint">
                  {isCard
                    ? "En una tarjeta de crédito, lo que debes se anota en negativo (ej. -150000)."
                    : "Desde aquí, el saldo se actualiza solo con cada ingreso y gasto que registres."}
                </span>
              </label>
            )}

            {isCard && (
              <label>
                Cupo total de la tarjeta (opcional)
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="Ej. 500000"
                />
                <span className="field-hint">
                  Lo encuentras en tu estado de cuenta. Te mostraremos cuánto llevas usado y cuánto te queda.
                </span>
              </label>
            )}

            {error && <p className="error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={isEdit ? onClose : goBack}>
                {isEdit ? "Cancelar" : "Atrás"}
              </button>
              <button type="submit" disabled={submitting || !canSubmit}>
                {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cuenta"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
