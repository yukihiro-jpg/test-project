'use client';

import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  placeholder?: string;
}

export function CurrencyInput({ label, value, onChange, suffix = '円', placeholder }: CurrencyInputProps) {
  return (
    <Input
      type="number"
      label={label}
      value={value || ''}
      onChange={e => onChange(Number(e.target.value) || 0)}
      suffix={suffix}
      placeholder={placeholder}
      min={0}
    />
  );
}

/**
 * 金額を日本円フォーマットで表示
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount) + '円';
}

/**
 * 金額を万円単位で表示
 */
export function formatManyen(amount: number): string {
  if (amount >= 100_000_000) {
    return (amount / 100_000_000).toFixed(1) + '億円';
  }
  if (amount >= 10_000) {
    return Math.floor(amount / 10_000).toLocaleString() + '万円';
  }
  return formatCurrency(amount);
}
