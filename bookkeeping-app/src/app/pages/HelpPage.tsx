import { useState } from 'react'

type HelpSection = 'overview' | 'cash' | 'bank' | 'csv-import' | 'csv-account' | 'export' | 'alerts' | 'settings'

const SECTIONS: { id: HelpSection; title: string }[] = [
  { id: 'overview', title: 'アプリの概要' },
  { id: 'cash', title: '現金出納帳の使い方' },
  { id: 'bank', title: '通帳記録の使い方' },
  { id: 'csv-import', title: '通帳CSVの取り込み方法' },
  { id: 'csv-account', title: '勘定科目コードの設定' },
  { id: 'export', title: 'データのダウンロード' },
  { id: 'alerts', title: 'アラートについて' },
  { id: 'settings', title: '設定の変更' },
]

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<HelpSection>('overview')

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-gray-800 mb-6">操作ガイド</h1>

      <div className="flex gap-6">
        {/* 目次 */}
        <nav className="w-48 flex-shrink-0">
          <ul className="space-y-1">
            {SECTIONS.map(({ id, title }) => (
              <li key={id}>
                <button
                  onClick={() => setActiveSection(id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* コンテンツ */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
          {activeSection === 'overview' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">アプリの概要</h2>
              <p className="text-sm text-gray-700 mb-3">
                この帳簿管理アプリは、現金出納帳と通帳記録をかんたんに記録し、税理士にデータを提出するためのツールです。
              </p>
              <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">主な機能</h3>
              <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                <li><strong>現金出納帳</strong> - 日々の現金の出入りを記録します</li>
                <li><strong>通帳記録</strong> - 銀行口座の入出金を記録します</li>
                <li><strong>CSV取り込み</strong> - 通帳のCSVデータを一括で取り込めます</li>
                <li><strong>科目コード入力</strong> - 税理士が設定した科目コードで入力できます</li>
                <li><strong>学習機能</strong> - 過去の入力パターンを学習し、次回から自動入力します</li>
                <li><strong>Excel出力</strong> - 税理士に提出するExcelファイルをダウンロードできます</li>
              </ul>
              <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">画面構成</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                <li>左のメニューから各画面に移動できます</li>
                <li>「ホーム」- 今月の残高や直近の取引を確認</li>
                <li>「現金出納帳」- 現金の収入・支出を入力</li>
                <li>「通帳記録」- 銀行口座の入出金を入力</li>
                <li>「設定」- 会社情報や口座の管理</li>
              </ul>
            </div>
          )}

          {activeSection === 'cash' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">現金出納帳の使い方</h2>
              <ol className="text-sm text-gray-700 space-y-3 list-decimal pl-5">
                <li>左メニューから「現金出納帳」を選びます</li>
                <li>上部の月選択で入力したい月を選びます</li>
                <li>「前月繰越」に前月末の現金残高を入力します（初回のみ）</li>
                <li>
                  下部のフォームに取引情報を入力します：
                  <ul className="mt-1 space-y-1 list-disc pl-5 text-gray-500">
                    <li><strong>日付</strong> - 取引日を選択</li>
                    <li><strong>摘要</strong> - 取引の内容（例: 文房具購入）</li>
                    <li><strong>取引先</strong> - 相手先の名前</li>
                    <li><strong>収入/支出</strong> - 金額を入力（どちらか一方）</li>
                  </ul>
                </li>
                <li>「追加」ボタンで登録します</li>
                <li>残高は自動で計算されます</li>
                <li>「残高確認」ボタンで実際の現金残高と帳簿の差額を確認できます</li>
              </ol>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                取引先の名前を入力すると、過去の入力履歴から摘要が自動で候補表示されます。
              </div>
            </div>
          )}

          {activeSection === 'bank' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">通帳記録の使い方</h2>
              <ol className="text-sm text-gray-700 space-y-3 list-decimal pl-5">
                <li>「設定」画面で銀行口座を登録します</li>
                <li>「通帳記録」画面で口座を選択します</li>
                <li>月を選択し、「前月繰越」を設定します</li>
                <li>
                  フォームに取引を入力します：
                  <ul className="mt-1 space-y-1 list-disc pl-5 text-gray-500">
                    <li><strong>日付</strong> - 通帳に記載された日付</li>
                    <li><strong>摘要（通帳記載）</strong> - 通帳に印字されている内容</li>
                    <li><strong>取引内容/科目コード</strong> - 仕訳の勘定科目</li>
                    <li><strong>取引先</strong> - 相手先</li>
                    <li><strong>入金/出金</strong> - 金額</li>
                  </ul>
                </li>
                <li>「追加」ボタンで登録</li>
              </ol>
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                内容がわからない取引は「仮払金」と入力してください。税理士から確認資料の提出を求められます。
              </div>
            </div>
          )}

          {activeSection === 'csv-import' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">通帳CSVの取り込み方法</h2>
              <p className="text-sm text-gray-700 mb-3">
                銀行のインターネットバンキングからダウンロードしたCSVファイルを取り込めます。
              </p>
              <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">CSVファイルの形式</h3>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 font-mono text-xs text-gray-600">
                日付,摘要,入金額,出金額<br />
                2026-04-01,カ）ヤマダショウジ,500000,<br />
                2026-04-05,デンキリョウキン,,15000<br />
                2026-04-10,ヤチン,,100000
              </div>
              <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
                <li>通帳記録画面で「CSV取り込み」ボタンをクリック</li>
                <li>CSVファイルを選択</li>
                <li>データが自動的に取り込まれます</li>
              </ol>
              <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">学習機能について</h3>
              <p className="text-sm text-gray-700">
                1回目の取り込み時は取引内容が不明なため「仮払金」として登録されます。
                手動で正しい取引内容を設定すると、次回以降は同じ摘要の取引に自動で取引内容が設定されます。
              </p>
              <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                使えば使うほど学習が進み、自動入力の精度が上がります。
              </div>
            </div>
          )}

          {activeSection === 'csv-account' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">勘定科目コードの設定</h2>
              <p className="text-sm text-gray-700 mb-3">
                税理士が事前にCSVファイルで勘定科目コードを登録すると、顧問先はコードを選択するだけで入力できます。
              </p>
              <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">科目コードCSVの形式</h3>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 font-mono text-xs text-gray-600">
                コード,科目名,分類<br />
                100,現金,資産<br />
                110,普通預金,資産<br />
                400,売上高,収益<br />
                500,仕入高,費用<br />
                510,給与手当,費用
              </div>
              <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
                <li>「設定」画面の「勘定科目コード」セクションへ移動</li>
                <li>「CSVから取り込み」ボタンをクリック</li>
                <li>CSVファイルを選択して取り込み</li>
                <li>取り込み後、取引入力時にドロップダウンで科目を選択できます</li>
              </ol>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                この機能は税理士がアプリ配布前に設定するためのものです。
              </div>
            </div>
          )}

          {activeSection === 'export' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">データのダウンロード</h2>
              <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
                <li>現金出納帳または通帳記録の画面を開きます</li>
                <li>対象の月を選択します</li>
                <li>右上の「今月分をダウンロード」ボタンをクリック</li>
                <li>保存先を選んでExcelファイルをダウンロード</li>
                <li>ダウンロードしたファイルを税理士に渡してください</li>
              </ol>
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                ダウンロード後、追加で必要な資料のアラートが表示されます。指示に従って資料を準備してください。
              </div>
            </div>
          )}

          {activeSection === 'alerts' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">アラートについて</h2>
              <p className="text-sm text-gray-700 mb-4">
                特定の取引を入力した場合やデータをダウンロードした場合に、アラートが表示されます。
              </p>
              <div className="space-y-4">
                <div className="border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-yellow-700 mb-2">仮払金アラート</h3>
                  <p className="text-sm text-gray-600">
                    取引内容が「仮払金」の場合に表示されます。
                    請求書や領収書などの確認資料をPDFまたはFAXで税理士にお渡しください。
                  </p>
                </div>
                <div className="border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-yellow-700 mb-2">借入アラート</h3>
                  <p className="text-sm text-gray-600">
                    借入金に関する取引を入力した場合に表示されます。
                    借入契約書・返済予定表などの詳細資料を税理士にお渡しください。
                  </p>
                </div>
                <div className="border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-blue-700 mb-2">ダウンロード後アラート</h3>
                  <p className="text-sm text-gray-600">
                    データをダウンロードした後に表示されます。
                    税理士に渡す追加資料の一覧を確認してください。
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">設定の変更</h2>
              <h3 className="text-sm font-bold text-gray-700 mb-2">会社情報</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 mb-4">
                <li>会社名を変更できます</li>
                <li>決算月を設定すると、月選択の表示が変わります</li>
                <li>データの保存先フォルダを変更できます</li>
              </ul>
              <h3 className="text-sm font-bold text-gray-700 mb-2">銀行口座</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 mb-4">
                <li>「+ 口座を追加」から銀行口座を登録できます</li>
                <li>銀行名・支店名・口座番号・期首残高を設定してください</li>
                <li>不要な口座は「削除」ボタンで削除できます</li>
              </ul>
              <h3 className="text-sm font-bold text-gray-700 mb-2">税理士メモ</h3>
              <p className="text-sm text-gray-700 mb-4">
                税理士がこの顧問先に対するメモを記載できます。顧問先には表示されません。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
