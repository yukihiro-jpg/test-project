import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP").format(amount);
}

export function calcAge(birthDate: string, baseDate: string): number {
  const birth = new Date(birthDate);
  const base = new Date(baseDate);
  let age = base.getFullYear() - birth.getFullYear();
  const m = base.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && base.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
