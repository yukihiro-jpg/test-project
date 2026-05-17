// Simple toast/alert helper. Currently uses window.alert for reliability,
// but centralized so it can be upgraded to a non-blocking toast later.
export function showError(err: unknown): void {
  const e = err as { message?: string; code?: string };
  const msg = e?.message || String(err);
  const code = e?.code ? `[${e.code}] ` : '';
  alert(code + msg);
}

export function showInfo(msg: string): void {
  alert(msg);
}
