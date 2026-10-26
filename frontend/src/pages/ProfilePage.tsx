import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { changePassword, deleteMyAccount, getMySummary, updateMe } from "../api/auth";
import type { UserSummary } from "../api/auth";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { apiErrorDetail } from "../utils/apiError";
import { getInitials } from "../utils/user";

function memberSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("es-CL", { month: "long", year: "numeric" }).replace(" de ", " ");
}

type Notice = { kind: "ok" | "error"; text: string } | null;

function NoticeText({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p className={notice.kind === "ok" ? "form-success" : "error"} role="status">
      {notice.text}
    </p>
  );
}

export default function ProfilePage() {
  const { user, updateUser, applySession, logout } = useAuth();
  const [summary, setSummary] = useState<UserSummary | null>(null);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<Notice>(null);

  useEffect(() => {
    getMySummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  if (!user) return null;

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
  const displayName = user.full_name || user.email;

  async function handleProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const updated = await updateMe({
        full_name: fullName,
        ...(emailChanged ? { email: email.trim(), current_password: emailPassword } : {}),
      });
      updateUser(updated);
      setEmail(updated.email);
      setEmailPassword("");
      setProfileNotice({ kind: "ok", text: "Datos guardados." });
    } catch (err) {
      setProfileNotice({ kind: "error", text: apiErrorDetail(err) ?? "No se pudieron guardar los cambios." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ kind: "error", text: "Las contraseñas nuevas no coinciden." });
      return;
    }
    setSavingPassword(true);
    setPasswordNotice(null);
    try {
      applySession(await changePassword(currentPassword, newPassword));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice({
        kind: "ok",
        text: "Contraseña actualizada. Si tenías la sesión abierta en otro dispositivo, se cerró.",
      });
    } catch (err) {
      setPasswordNotice({ kind: "error", text: apiErrorDetail(err) ?? "No se pudo cambiar la contraseña." });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (!deleteConfirmed) return;
    setDeleting(true);
    setDeleteNotice(null);
    try {
      await deleteMyAccount(deletePassword);
      // Se borra el token y se recarga en la portada: así no queda ninguna pantalla protegida pidiendo
      // datos con la sesión de una cuenta que ya no existe.
      logout();
      window.location.replace("/");
    } catch (err) {
      setDeleteNotice({ kind: "error", text: apiErrorDetail(err) ?? "No se pudo eliminar la cuenta." });
      setDeleting(false);
    }
  }

  return (
    <div className="page profile-page">
      <div className="profile-hero card">
        <span className="profile-avatar" aria-hidden="true">
          {getInitials(displayName)}
        </span>
        <div>
          <h1>{user.full_name || "Mi perfil"}</h1>
          <p className="cell-muted">
            {user.email} · Usando FinanzApp desde {memberSince(user.created_at)}
          </p>
        </div>
      </div>

      {summary && (
        <div className="summary-strip profile-summary">
          <div className="summary-item">
            <span className="summary-label">Cuentas</span>
            <span className="summary-value">{summary.accounts}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Transacciones</span>
            <span className="summary-value">{summary.transactions}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Transferencias</span>
            <span className="summary-value">{summary.transfers}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Metas de ahorro</span>
            <span className="summary-value">{summary.savings_goals}</span>
          </div>
        </div>
      )}

      {user.is_demo && (
        <div className="tip-card tip-card-warning">
          <strong>Cuenta demo:</strong> puedes recorrer toda la app, pero el nombre, el email, la contraseña y la
          eliminación de esta cuenta están bloqueados para que siga disponible para todos.
        </div>
      )}

      <fieldset className="profile-fieldset" disabled={user.is_demo}>
        <div className="profile-grid">
          <section className="card">
            <h2>Datos personales</h2>
            <form className="modal-form" onSubmit={handleProfile}>
              <label>
                Nombre
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="¿Cómo te llamas?"
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              {emailChanged && (
                <label>
                  Tu contraseña actual
                  <PasswordInput
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <span className="field-hint">Por seguridad, cambiar el email requiere tu contraseña.</span>
                </label>
              )}
              <NoticeText notice={profileNotice} />
              <div className="modal-actions">
                <button type="submit" disabled={savingProfile}>
                  {savingProfile ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>Cambiar contraseña</h2>
            <form className="modal-form" onSubmit={handlePassword}>
              <label>
                Contraseña actual
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                Nueva contraseña
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
                <span className="field-hint">Mínimo 6 caracteres. Mejor una que no uses en otros sitios.</span>
              </label>
              <label>
                Repite la nueva contraseña
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </label>
              <NoticeText notice={passwordNotice} />
              <div className="modal-actions">
                <button type="submit" disabled={savingPassword}>
                  {savingPassword ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </fieldset>

      <fieldset className="profile-fieldset" disabled={user.is_demo}>
        <section className="card danger-zone">
          <h2>Eliminar mi cuenta</h2>
          <p className="cell-muted">
            Se borrarán para siempre tus cuentas, transacciones, transferencias, categorías y metas de ahorro. No se
            puede deshacer.
          </p>
          <form className="danger-form" onSubmit={handleDelete}>
            <label>
              Escribe tu contraseña para confirmar
              <PasswordInput
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={deleteConfirmed} onChange={(e) => setDeleteConfirmed(e.target.checked)} />
              Entiendo que perderé todos mis datos
            </label>
            <NoticeText notice={deleteNotice} />
            <div>
              <button
                type="submit"
                className="button-danger"
                disabled={!deleteConfirmed || !deletePassword || deleting}
              >
                {deleting ? "Eliminando..." : "Eliminar mi cuenta"}
              </button>
            </div>
          </form>
        </section>
      </fieldset>
    </div>
  );
}
