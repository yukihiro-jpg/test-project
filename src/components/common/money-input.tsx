'use client';

import { useState, useCallback } from 'react';

/**
 * A raw <input> replacement for monetary values in table cells.
 * Displays comma-formatted numbers when not focused,
 * shows raw digits when focused for easy editing.
 */
interface MoneyInputProps {
  value: number | '';
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  placeholder?: string;
}

function formatWithCommas(num: number | ''): string {
  if (num === '' || num === 0) return '';
  return Number(num).toLocaleString('ja-JP');
}

export function MoneyInput({ value, onChange, className, min, placeholder }: MoneyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawValue, setRawValue] = useState('');

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setRawValue(value ? String(value) : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/[^0-9]/g, '');
      setRawValue(digits);
      const parsed = Number(digits) || 0;
      if (min !== undefined && parsed < min) return;
      onChange(parsed);
    },
    [onChange, min],
  );

  return (
    <input
      type="text"
      inputMode="numeric"
      value={isFocused ? rawValue : formatWithCommas(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
}
