// La demo pública se activa por deploy (VITE_DEMO_ENABLED=true); en local queda apagada por defecto.
export const DEMO_ENABLED = import.meta.env.VITE_DEMO_ENABLED === "true";
