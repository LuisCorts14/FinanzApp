import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "../api/settings";
import type { UserSettings } from "../api/settings";
import { SettingsContext } from "../context/settingsContext";

// Carga la configuración una vez por sesión; si falla, la app sigue con los valores por defecto.
export default function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoaded(true));
  }, []);

  async function update(patch: Partial<UserSettings>) {
    const next = await updateSettings(patch);
    setSettings(next);
    return next;
  }

  return <SettingsContext.Provider value={{ settings, loaded, update }}>{children}</SettingsContext.Provider>;
}
