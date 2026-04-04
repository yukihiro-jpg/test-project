'use client';

import { useState, useCallback } from 'react';

interface PdfUploaderProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function PdfUploader({ onUpload, isLoading }: PdfUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf',
      );
      files.forEach((file) => onUpload(file));
    },
    [onUpload],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach((file) => onUpload(file));
      e.target.value = '';
    },
    [onUpload],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50'
      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">PDFを解析中...</p>
        </div>
      ) : (
        <>
          <p className="text-gray-600 mb-2">
            保険証券・支払通知書のPDFをドラッグ&ドロップ
          </p>
          <p className="text-sm text-gray-400 mb-4">または</p>
          <label className="inline-block bg-white border border-gray-300 rounded-md px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors">
            ファイルを選択
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </>
      )}
    </div>
  );
}
