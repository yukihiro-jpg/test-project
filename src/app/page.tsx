import DecedentForm from '@/components/DecedentForm';

export default function HomePage() {
  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            相続税 保���資産分類ツール
          </h1>
          <p className="text-gray-600">
            保険証券・支払通知書のPDFから保険資産区分を自動判定し、評価額を算出します
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <DecedentForm />
        </div>
      </div>
    </main>
  );
}
