import { createContext, useContext } from "react";
import { DEFAULT_SETTINGS } from "../api/settings";
import type { UserSettings } from "../api/settings";

export interface SettingsContextValue {
  settings: UserSettings;
  loaded: boolean;
  update: (patch: Partial<UserSettings>) => Promise<UserSettings>;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  update: async () => DEFAULT_SETTINGS,
});

export function useSettings() {
  return useContext(SettingsContext);
}
