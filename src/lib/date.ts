function extractYmd(s: string): { y: string; m: string; d: string } | null {
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return {
    y: digits.slice(0, 4),
    m: digits.slice(4, 6),
    d: digits.slice(6, 8),
  };
}

export function formatDateJa(s: string): string {
  const ymd = extractYmd(s);
  if (!ymd) return s;
  return `${ymd.y}年${ymd.m}月${ymd.d}日`;
}

export function formatDateIso(s: string): string {
  const ymd = extractYmd(s);
  if (!ymd) return s;
  return `${ymd.y}-${ymd.m}-${ymd.d}`;
}

export function dateDigits(s: string): string {
  const ymd = extractYmd(s);
  return ymd ? `${ymd.y}${ymd.m}${ymd.d}` : "";
}
