'use client';

import Link from 'next/link';
import { useCaseStore } from '@/lib/store/case-store';

export function Header() {
  const currentCase = useCaseStore(s => s.getCurrentCase());

  return (
    <header className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-bold text-blue-700">
          相続税業務管理アプリ
        </Link>
        {currentCase && (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">
              {currentCase.decedent.name || '新規案件'}
            </span>
          </>
        )}
      </div>
      <div className="text-xs text-gray-400">
        {currentCase && `基準日: ${currentCase.referenceDate}`}
      </div>
    </header>
  );
}
