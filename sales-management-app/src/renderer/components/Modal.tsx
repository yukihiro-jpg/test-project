import { ReactNode } from 'react';

export default function Modal({ open, onClose, title, children, widthClass = 'max-w-2xl' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className={`bg-white rounded shadow-lg w-full ${widthClass} max-h-[90vh] overflow-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button className="text-gray-500 hover:text-black" onClick={onClose}>×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
