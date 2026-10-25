import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "../api/auth";
import type { TokenResponse, User } from "../api/auth";
import { TOKEN_STORAGE_KEY } from "../api/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  // Para el perfil: actualizar los datos mostrados o guardar el token nuevo tras cambiar la contraseña.
  updateUser: (user: User) => void;
  applySession: (session: TokenResponse) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY))
      .finally(() => setLoading(false));
  }, []);

  function applySession(session: TokenResponse) {
    localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
    setUser(session.user);
  }

  async function login(email: string, password: string) {
    applySession(await authApi.login(email, password));
  }

  async function register(email: string, password: string, fullName?: string) {
    applySession(await authApi.register(email, password, fullName));
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser: setUser, applySession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
