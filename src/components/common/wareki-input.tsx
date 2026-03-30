'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { toWareki, isValidDate } from '@/lib/dates/wareki';

interface WarekiInputProps {
  label: string;
  value: string;       // YYYY-MM-DD
  onChange: (value: string) => void;
  showWareki?: boolean;
}

export function WarekiInput({ label, value, onChange, showWareki = true }: WarekiInputProps) {
  const [wareki, setWareki] = useState('');

  useEffect(() => {
    if (value && isValidDate(value)) {
      setWareki(toWareki(value));
    } else {
      setWareki('');
    }
  }, [value]);

  return (
    <div className="space-y-1">
      <Input
        type="date"
        label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {showWareki && wareki && (
        <p className="text-xs text-gray-500 ml-1">
          和暦: {wareki}
        </p>
      )}
    </div>
  );
}
