'use client'

import Link from 'next/link'
import { BackLink, Card, PageContainer, PageTitle, SectionLabel } from '@/components/tax/ui'
import { ReactNode } from 'react'

function PhoneFrame({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="my-3">
      <div className="mx-auto max-w-[280px] bg-[#F2F2F7] rounded-[28px] ring-8 ring-gray-900/90 shadow-xl overflow-hidden">
        <div className="bg-gray-900 h-5 flex items-center justify-center">
          <div className="w-16 h-1 bg-gray-700 rounded-full" />
        </div>
        <div className="p-3 text-[10px] leading-tight">{children}</div>
      </div>
      {caption && <p className="text-[12px] text-gray-500 text-center mt-2">{caption}</p>}
    </div>
  )
}

function MiniCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-2 ${className}`}>
      {children}
    </div>
  )
}

function MiniInput({ label, value, hint }: { label: string; value?: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <div className="text-[8px] text-gray-500 mb-0.5">{label}</div>
      <div className="bg-gray-100 rounded-md px-1.5 py-1 text-[9px] text-gray-700">
        {value || <span className="text-gray-400">入力欄</span>}
      </div>
      {hint && <div className="text-[7px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  )
}

function MiniToggle({ on = true, label }: { on?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-100">
      <span className="text-[8px] text-gray-700">{label}</span>
      <div className={`w-7 h-4 rounded-full relative ${on ? 'bg-green-500' : 'bg-gray-300'}`}>
        <div
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition ${
            on ? 'left-3.5' : 'left-0.5'
          }`}
        />
      </div>
    </div>
  )
}

function Step({ num, title, children }: { num: number; title: string; children: ReactNode }) {
  return (
    <Card className="!p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-[14px] font-bold flex items-center justify-center shrink-0">
          {num}
        </div>
        <h3 className="text-[17px] font-bold text-gray-900">{title}</h3>
      </div>
      {children}
    </Card>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200/60 px-3 py-2 text-[13px] text-amber-900 leading-relaxed">
      💡 {children}
    </div>
  )
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-red-50 ring-1 ring-red-200/60 px-3 py-2 text-[13px] text-red-900 leading-relaxed">
      ⚠️ {children}
    </div>
  )
}

export default function HelpPage() {
  return (
    <PageContainer>
      <BackLink href="/tax" />
      <PageTitle>使い方ガイド</PageTitle>
      <p className="text-[14px] text-gray-600 mb-5 leading-relaxed">
        このアプリで毎月の源泉所得税を計算し、納付書イメージと税理士提出用のCSVを作成できます。
        以下の順番でご利用ください。
      </p>

      <SectionLabel>① 初期設定（最初の1回だけ）</SectionLabel>
      <Step num={1} title="納付者情報を登録">
        <p className="text-[14px] text-gray-700 leading-relaxed mb-3">
          画面右上の <b>⚙ 設定</b> ボタンから <b>「納付者情報」</b> を開き、税務署名・整理番号・住所・氏名などを入力します。納付書イメージに自動反映されます。
        </p>
        <PhoneFrame caption="設定 → 納付者情報">
          <div className="text-[11px] font-bold mb-2 text-gray-900">納付者情報</div>
          <MiniCard>
            <MiniInput label="税務署名" value="渋谷" />
            <MiniInput label="整理番号" value="●●●●●●●●" hint="8桁" />
            <MiniInput label="住所" value="東京都渋谷区…" />
            <MiniInput label="氏名" value="●● ●●" />
            <MiniToggle on={false} label="納期の特例" />
          </MiniCard>
        </PhoneFrame>
        <Hint>
          納期の特例（半年に1回納付）を適用している場合は、トグルをONにしてください。給与所得の納付書集計が自動で半期になります。
        </Hint>
      </Step>

      <Step num={2} title="従業員を登録">
        <p className="text-[14px] text-gray-700 leading-relaxed mb-3">
          <b>⚙設定 → 従業員の登録</b> から、ホステス・乙欄従業員を1人ずつ追加します。氏名・フリガナ・<b className="text-pink-600">源氏名</b>・住所・生年月日・メモ・<b>外部報告の可否</b>を登録できます。
        </p>
        <PhoneFrame caption="従業員の登録">
          <div className="text-[11px] font-bold mb-2 text-gray-900">従業員の登録</div>
          <MiniCard>
            <MiniInput label="氏名" value="山田 花子" />
            <MiniInput label="フリガナ" value="ヤマダ ハナコ" />
            <MiniInput label="源氏名" value="れな" hint="店内呼称（任意）" />
            <MiniInput label="生年月日" value="2000-04-15" />
            <div className="mb-1.5">
              <div className="text-[8px] text-gray-500 mb-0.5">区分</div>
              <div className="bg-gray-100 rounded-md px-1.5 py-1 text-[9px] text-gray-700 flex justify-between">
                <span>ホステス</span>
                <span className="text-gray-400">▽</span>
              </div>
            </div>
            <MiniToggle on={true} label="税務署への報告対象とする" />
          </MiniCard>
        </PhoneFrame>
        <Hint>
          <b>区分</b>はホステス／一般従業員（乙欄）から選択。区分によって源泉税の計算式が自動で切り替わります。
        </Hint>
        <Warn>
          <b>「税務署への報告対象とする」</b>がOFFの人は、CSV内で「対象外」と区分されて記載されます。
          税理士は内部管理用に全員分の支払記録を受け取りますが、年末調整や法定調書の段階で対象外と扱われます。
        </Warn>
      </Step>

      <Step num={3} title="税理士報酬を登録">
        <p className="text-[14px] text-gray-700 leading-relaxed mb-3">
          <b>⚙設定 → 税理士報酬の登録</b> から税理士を追加します。税抜の報酬額と、支払月を月別チェックボックスで指定します。
        </p>
        <PhoneFrame caption="税理士報酬の登録">
          <div className="text-[11px] font-bold mb-2 text-gray-900">税理士報酬の登録</div>
          <MiniCard>
            <MiniInput label="氏名・名称" value="山田税理士事務所" />
            <MiniInput label="報酬額" value="50,000" hint="税抜・1回あたり" />
            <div className="mt-1.5 rounded-md bg-blue-50 p-1.5 text-[8px] space-y-0.5">
              <div className="flex justify-between"><span>税抜報酬額</span><b>50,000円</b></div>
              <div className="flex justify-between"><span>税込支払額</span><b>55,000円</b></div>
              <div className="flex justify-between text-red-600"><span>源泉税</span><b>−5,105円</b></div>
              <div className="flex justify-between border-t border-blue-200 pt-0.5 mt-0.5"><span className="font-semibold">差引</span><b>49,895円</b></div>
            </div>
            <div className="mt-2">
              <div className="text-[8px] text-gray-500 mb-0.5">支払月</div>
              <div className="grid grid-cols-6 gap-0.5">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <div key={m} className="bg-blue-500 text-white text-[7px] text-center py-0.5 rounded-full">{m}月</div>
                ))}
              </div>
            </div>
          </MiniCard>
        </PhoneFrame>
        <Hint>
          毎月支払う税理士は全月チェック、特定月だけ支払う場合はその月だけチェック。納付書集計に自動反映されます。
        </Hint>
      </Step>

      <SectionLabel>② 毎日の運用</SectionLabel>
      <Step num={4} title="その日の支払を記録">
        <p className="text-[14px] text-gray-700 leading-relaxed mb-3">
          トップの <b>「毎日の給与・報酬の支払」</b> から、その日支払う人を選んで金額を入力します。区分に応じて源泉税と差引支払額が自動計算されます。
        </p>
        <PhoneFrame caption="毎日の給与・報酬の支払">
          <div className="text-[11px] font-bold mb-2 text-gray-900">毎日の給与・報酬の支払</div>
          <MiniCard>
            <MiniInput label="日付" value="2026-05-15" />
            <div className="mb-1.5">
              <div className="text-[8px] text-gray-500 mb-0.5">対象者</div>
              <div className="bg-gray-100 rounded-md px-1.5 py-1 text-[8.5px] flex justify-between">
                <span className="truncate">山田 花子（源氏名：れな）／ホステス</span>
                <span className="text-gray-400">▽</span>
              </div>
            </div>
            <MiniInput label="本日の支払額" value="25,000" />
            <div className="mt-1.5 rounded-md bg-blue-50 p-1.5 text-[8px] space-y-0.5">
              <div className="flex justify-between"><span>支払額</span><b>25,000円</b></div>
              <div className="flex justify-between text-red-600"><span>源泉税(10.21%)</span><b>−2,042円</b></div>
              <div className="flex justify-between border-t border-blue-200 pt-0.5 mt-0.5"><span className="font-semibold">本人へ支払う金額</span><b className="text-green-700">22,958円</b></div>
            </div>
          </MiniCard>
          <div className="mt-2 bg-blue-500 text-white text-[10px] text-center py-1.5 rounded-lg font-semibold">
            記録する
          </div>
        </PhoneFrame>
        <Hint>
          選択肢には<b>「本名（源氏名：●●）／区分」</b>の形で両方表示されるので、店内呼称からでも本名からでも探せます。
        </Hint>
      </Step>

      <Step num={5} title="間違いに気づいたら編集・削除">
        <p className="text-[14px] text-gray-700 leading-relaxed mb-3">
          画面下部の<b>「当日の記録」</b>または<b>「最近の記録」</b>から、編集したい行をタップすると入力欄に内容がコピーされます。日付・対象者・金額を直して<b>「更新する」</b>を押すと修正完了。<b>「削除」</b>ボタンで取り消しもできます。
        </p>
        <PhoneFrame caption="記録の編集・削除">
          <div className="text-[11px] font-bold mb-2 text-gray-900">2026-05-15 の記録</div>
          <MiniCard className="ring-2 ring-blue-400">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="text-[9px] font-semibold">
                  山田 花子
                  <span className="text-pink-600 ml-1">（れな）</span>
                  <span className="text-gray-500 ml-1">ホステス</span>
                </div>
                <div className="text-[7.5px] text-gray-500 mt-0.5">総額 25,000 / 税 2,042 / 手取 22,958</div>
              </div>
              <div className="flex flex-col gap-0.5 ml-1">
                <span className="text-[8px] text-blue-500">編集</span>
                <span className="text-[8px] text-red-500">削除</span>
              </div>
            </div>
          </MiniCard>
          <div className="mt-2 rounded-md bg-amber-50 ring-1 ring-amber-200 px-1.5 py-1 text-[8px] text-amber-900">
            ✏️ 既存の記録を編集中です
          </div>
          <div className="mt-1 bg-blue-500 text-white text-[10px] text-center py-1.5 rounded-lg font-semibold">
            更新する
          </div>
        </PhoneFrame>
        <Hint>
          「最近の記録」一覧の各行もタップで編集モードに入ります。誤入力があってもいつでも直せます。
        </Hint>
      </Step>

      <SectionLabel>③ 月末の作業</SectionLabel>
      <Step num={6} title="納付書イメージを確認">
        <p className="text-[14px] text-gray-700 leading-relaxed mb-3">
          トップの <b>「納付書イメージを表示」</b> から、月を選んで給与所得（30203）または報酬・料金等（32319）の納付書イメージを確認します。紙の納付書に転記する用です。
        </p>
        <PhoneFrame caption="納付書イメージ">
          <div className="text-[11px] font-bold mb-2 text-gray-900">納付書イメージ</div>
          <MiniCard>
            <div className="mb-1.5">
              <div className="text-[8px] text-gray-500 mb-0.5">納付書種類</div>
              <div className="bg-gray-100 rounded-md px-1.5 py-1 text-[9px]">給与所得・退職所得等（30203）</div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <MiniInput label="年" value="2026" />
              <MiniInput label="月" value="5月" />
            </div>
          </MiniCard>
          <div className="mt-2 rounded-md bg-amber-50 p-1.5">
            <div className="text-[7px] text-amber-700">納付期限</div>
            <div className="text-[10px] font-bold text-amber-900">2026年6月10日（水）</div>
          </div>
          <div className="mt-2 rounded-md bg-blue-50 p-1.5 text-[8px]">
            <div>給与所得 本税：<b>34,510円</b></div>
            <div>報酬・料金 本税：<b>91,890円</b></div>
          </div>
        </PhoneFrame>
        <Hint>
          納期特例ONの場合、給与所得は <b>上半期（1〜6月）／下半期（7〜12月）</b> から選べます。報酬・料金（ホステス）は対象外で常に毎月。
        </Hint>
      </Step>

      <Step num={7} title="税理士提出用ファイルをダウンロード">
        <p className="text-[14px] text-gray-700 leading-relaxed mb-3">
          トップの <b>「CSV書き出し」</b> から、<b>開始月〜終了月</b>を選んで <b>「税理士提出用ファイルをまとめてダウンロード」</b> をタップ。複数月を一度に出力できます（月ごとに別ファイル）。
        </p>
        <PhoneFrame caption="CSV書き出し（範囲指定）">
          <div className="text-[11px] font-bold mb-2 text-gray-900">CSV書き出し</div>
          <MiniCard>
            <div className="text-[7.5px] text-gray-500 mb-1">開始月</div>
            <div className="grid grid-cols-2 gap-1">
              <MiniInput label="年" value="2026" />
              <MiniInput label="月" value="3月" />
            </div>
            <div className="text-[7.5px] text-gray-500 mb-1 mt-1.5">終了月</div>
            <div className="grid grid-cols-2 gap-1">
              <MiniInput label="年" value="2026" />
              <MiniInput label="月" value="5月" />
            </div>
          </MiniCard>
          <div className="mt-2 rounded-md bg-blue-50 p-1.5 text-[8px] text-blue-900 leading-snug">
            📦 出力対象: <b>3ヶ月分</b>（2026-03〜2026-05）<br />
            ファイル数: <b>16個</b>
          </div>
          <div className="mt-2 bg-blue-500 text-white text-[9px] text-center py-1.5 rounded-lg font-semibold leading-tight">
            税理士提出用ファイルを<br/>まとめてダウンロード
          </div>
          <div className="text-[7px] text-gray-400 mt-1">スマホでは共有メニューが開きます</div>
        </PhoneFrame>
        <Hint>
          範囲指定すると、月ごとに別々のCSVファイルとしてZIPに格納されます（合算されません）。<br/>
          <b>従業員台帳</b>は範囲内の最新月の状態が1ファイルだけ入ります。
        </Hint>
        <Hint>
          スマホでタップすると「共有メニュー」が開きます。LINE・メール・<b>ファイル App</b>から選んで保存・送信できます。<br/>
          パソコンでは通常のダウンロードになります。
        </Hint>
        <Hint>
          CSVには<b className="text-pink-600">源氏名</b>と<b>税務署報告区分（対象/対象外）</b>の列が含まれます。
        </Hint>
      </Step>

      <SectionLabel>④ 月次の流れまとめ</SectionLabel>
      <Card className="!p-5 mt-2">
        <div className="space-y-2 text-[14px] leading-relaxed">
          <div className="flex gap-2">
            <span className="text-gray-400 shrink-0">毎日</span>
            <span>→ <b>「毎日の給与・報酬の支払」</b>で記録（間違いは編集・削除で訂正）</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 shrink-0">月末</span>
            <span>→ <b>「納付書イメージ」</b>で確認し、紙の納付書へ転記</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 shrink-0">月末</span>
            <span>→ <b>「CSV書き出し」</b>で税理士提出用ファイルをダウンロードして送信</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 shrink-0">翌月10日</span>
            <span>→ 納付書を金融機関で納付（納期特例は半年に1回）</span>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <Link
          href="/tax"
          className="block w-full bg-blue-500 text-white font-semibold rounded-2xl py-3.5 text-[16px] text-center active:bg-blue-600"
        >
          トップへ戻る
        </Link>
      </div>
    </PageContainer>
  )
}
