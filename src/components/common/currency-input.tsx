'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  placeholder?: string;
}

function formatWithCommas(num: number): string {
  if (!num) return '';
  return num.toLocaleString('ja-JP');
}

function parseFormattedNumber(str: string): number {
  return Number(str.replace(/,/g, '')) || 0;
}

export function CurrencyInput({ label, value, onChange, suffix = '円', placeholder }: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawValue, setRawValue] = useState('');

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setRawValue(value ? String(value) : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseFormattedNumber(rawValue);
    onChange(parsed);
  }, [rawValue, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setRawValue(val);
    onChange(Number(val) || 0);
  }, [onChange]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      label={label}
      value={isFocused ? rawValue : formatWithCommas(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      suffix={suffix}
      placeholder={placeholder}
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
