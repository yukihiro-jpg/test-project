'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useCaseStore } from '@/lib/store/case-store';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const caseId = params.id as string;
  const { initialized, initialize, selectCase } = useCaseStore();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    if (initialized && caseId) {
      selectCase(caseId);
    }
  }, [initialized, caseId, selectCase]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar caseId={caseId} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
