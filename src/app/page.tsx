/**
 * ダッシュボード（ログイン後の最初の画面）
 *
 * 表示内容：
 * - 顧問先一覧
 * - 各顧問先の最新月次報告の状況（未作成 / 下書き / 確定送付済み）
 * - 未解決の宿題数サマリー
 * - 新規月次報告の作成ボタン
 *
 * TODO: 実装は Step 4（社長プロファイル）後に本格化
 */

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold mb-8">月次財務報告アプリ</h1>
      <p className="text-gray-600">
        初期セットアップ完了。今後、顧問先一覧・月次報告生成機能を実装します。
      </p>
      <div className="mt-6 p-4 border border-dashed border-gray-400 rounded-lg bg-white">
        <h2 className="font-semibold mb-2">実装予定の機能</h2>
        <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
          <li>CSV取込（MJS会計大将 4帳票対応）</li>
          <li>月次報告資料の自動生成（7セクション構成）</li>
          <li>PDF / Excel 出力</li>
          <li>ページ単位コメント入力・Gmail送信</li>
          <li>AI叩き台コメント生成（Gemini）</li>
          <li>前月コメント引継ぎ・宿題追跡</li>
          <li>社長プロファイル機能</li>
          <li>業界ベンチマーク（e-Stat無料データ）</li>
        </ul>
      </div>
    </main>
  )
}
