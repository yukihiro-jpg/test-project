import { useMemo, useState } from "react";
import type {
  AmountStyle,
  BankInfo,
  ColumnMapping,
  ImportedCsv,
} from "../types";

interface Props {
  imported: ImportedCsv;
  initialMapping?: ColumnMapping | null;
  initialBankInfo?: BankInfo | null;
  templateMatched?: boolean;
  onConfirm: (mapping: ColumnMapping, info: BankInfo) => void;
  onBack: () => void;
}

const PREVIEW_ROW_COUNT = 5;

function ColumnSelect({
  value,
  onChange,
  headers,
  allowNone,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  headers: string[];
  allowNone?: boolean;
}) {
  return (
    <select
      value={value === null ? "" : value.toString()}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {allowNone && <option value="">（指定なし）</option>}
      {headers.map((h, idx) => (
        <option key={idx} value={idx}>
          {idx + 1}列目: {h || "(空)"}
        </option>
      ))}
    </select>
  );
}

export function MappingScreen({
  imported,
  initialMapping,
  initialBankInfo,
  templateMatched,
  onConfirm,
  onBack,
}: Props) {
  const [date, setDate] = useState<number>(initialMapping?.date ?? 0);
  const [summary, setSummary] = useState<number>(
    initialMapping?.summary ?? Math.min(2, imported.headers.length - 1),
  );
  const [balance, setBalance] = useState<number | null>(
    initialMapping?.balance ?? null,
  );
  const [amountStyle, setAmountStyle] = useState<AmountStyle>(
    initialMapping?.amountStyle ?? "split",
  );
  const [amount, setAmount] = useState<number | null>(
    initialMapping?.amount ?? null,
  );
  const [incoming, setIncoming] = useState<number | null>(
    initialMapping?.incoming ?? Math.min(3, imported.headers.length - 1),
  );
  const [outgoing, setOutgoing] = useState<number | null>(
    initialMapping?.outgoing ?? Math.min(4, imported.headers.length - 1),
  );

  const [bankName, setBankName] = useState(initialBankInfo?.bankName ?? "");
  const [accountName, setAccountName] = useState(
    initialBankInfo?.accountName ?? "",
  );

  const previewRows = useMemo(
    () => imported.rawRows.slice(0, PREVIEW_ROW_COUNT),
    [imported.rawRows],
  );

  const validAmount =
    amountStyle === "single" ? amount !== null : incoming !== null || outgoing !== null;
  const canSubmit = validAmount && bankName.trim() !== "";

  function handleSubmit() {
    if (!canSubmit) return;
    onConfirm(
      {
        date,
        summary,
        balance,
        amountStyle,
        amount: amountStyle === "single" ? amount : null,
        incoming: amountStyle === "split" ? incoming : null,
        outgoing: amountStyle === "split" ? outgoing : null,
      },
      {
        bankName: bankName.trim(),
        accountName: accountName.trim(),
      },
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">列マッピング</h1>
        <p className="mt-1 text-xs text-gray-600">
          読み込んだCSV「{imported.fileName}」のどの列が何にあたるかを指定してください。
        </p>
        {templateMatched && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-semibold text-emerald-800">
            登録済みテンプレートを自動適用しました。必要に応じて修正してください。
          </div>
        )}
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto p-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">マッピング設定</h2>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label="日付の列">
              <ColumnSelect
                value={date}
                onChange={(v) => setDate(v ?? 0)}
                headers={imported.headers}
              />
            </Field>

            <Field label="摘要の列">
              <ColumnSelect
                value={summary}
                onChange={(v) => setSummary(v ?? 0)}
                headers={imported.headers}
              />
            </Field>

            <Field label="金額の入力方式">
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="amount-style"
                    checked={amountStyle === "split"}
                    onChange={() => setAmountStyle("split")}
                  />
                  入金列・出金列の2列
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="amount-style"
                    checked={amountStyle === "single"}
                    onChange={() => setAmountStyle("single")}
                  />
                  金額1列（正負で区別）
                </label>
              </div>
            </Field>

            {amountStyle === "split" ? (
              <>
                <Field label="入金額の列">
                  <ColumnSelect
                    value={incoming}
                    onChange={setIncoming}
                    headers={imported.headers}
                    allowNone
                  />
                </Field>
                <Field label="出金額の列">
                  <ColumnSelect
                    value={outgoing}
                    onChange={setOutgoing}
                    headers={imported.headers}
                    allowNone
                  />
                </Field>
              </>
            ) : (
              <Field label="金額の列">
                <ColumnSelect
                  value={amount}
                  onChange={setAmount}
                  headers={imported.headers}
                />
              </Field>
            )}

            <Field label="残高の列（任意）">
              <ColumnSelect
                value={balance}
                onChange={setBalance}
                headers={imported.headers}
                allowNone
              />
            </Field>

            <div className="border-t border-gray-200 pt-4">
              <Field label="銀行名 *">
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="例: 三井住友銀行"
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </Field>
              <div className="mt-3">
                <Field label="口座名（任意）">
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="例: 本店営業部 普通"
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </Field>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            プレビュー（先頭{PREVIEW_ROW_COUNT}行）
          </h2>
          <div className="mt-3 overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {imported.headers.map((h, idx) => (
                    <th
                      key={idx}
                      className="whitespace-nowrap border-r border-gray-200 px-2 py-1 text-left font-medium last:border-r-0"
                    >
                      <div className="text-[10px] text-gray-500">
                        {idx + 1}列目
                      </div>
                      <div>{h || "(空)"}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ridx) => (
                  <tr
                    key={ridx}
                    className="border-t border-gray-100 odd:bg-white even:bg-gray-50"
                  >
                    {imported.headers.map((_, cidx) => (
                      <td
                        key={cidx}
                        className="whitespace-nowrap border-r border-gray-100 px-2 py-1 last:border-r-0"
                      >
                        {row[cidx] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={onBack}
        >
          戻る
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          この設定で編集を開始
        </button>
      </footer>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-700">
        {label}
      </span>
      {children}
    </label>
  );
}
