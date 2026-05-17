import { ReactNode } from 'react';

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-2">
      <span className="block text-sm text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`mt-1 w-full border rounded px-2 py-1 ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} className={`mt-1 w-full border rounded px-2 py-1 ${props.className ?? ''}`}>{props.children}</select>;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`mt-1 w-full border rounded px-2 py-1 ${props.className ?? ''}`} />;
}

export function Button({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 ${className}`}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 ${className}`}>
      {children}
    </button>
  );
}

export function DangerButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 ${className}`}>
      {children}
    </button>
  );
}
