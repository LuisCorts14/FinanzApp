type ApiError = { response?: { status?: number; data?: { detail?: unknown } } };

export function apiErrorStatus(err: unknown): number | undefined {
  return (err as ApiError)?.response?.status;
}

/** Mensaje de error que devuelve el backend (campo `detail`), si es texto. */
export function apiErrorDetail(err: unknown): string | undefined {
  const detail = (err as ApiError)?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

/** Si el backend bloqueó la acción por demasiados intentos (429), su mensaje con el tiempo de espera. */
export function tooManyAttemptsMessage(err: unknown): string | undefined {
  return apiErrorStatus(err) === 429 ? apiErrorDetail(err) ?? "Demasiados intentos. Espera unos minutos." : undefined;
}
