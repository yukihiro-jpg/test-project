import { useEffect, useMemo, useState } from "react";
import { listKnownAccounts, type KnownAccount } from "../lib/db";
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

const PREVIEW_ROW_COUNT = 10;

type RoleKey =
  | "date"
  | "summary"
  | "amount"
  | "incoming"
  | "outgoing"
  | "balance";

interface RoleDef {
  key: RoleKey;
  label: string;
  required: boolean;
  chip: string;
  cellBg: string;
  cellBgHover: string;
}

const ROLE_DEFS: Record<RoleKey, Omit<RoleDef, "key">> = {
  date: {
    label: "日付",
    required: true,
    chip: "bg-sky-100 text-sky-800 border-sky-300",
    cellBg: "bg-sky-50",
    cellBgHover: "bg-sky-100",
  },
  summary: {
    label: "摘要",
    required: true,
    chip: "bg-violet-100 text-violet-800 border-violet-300",
    cellBg: "bg-violet-50",
    cellBgHover: "bg-violet-100",
  },
  amount: {
    label: "金額",
    required: true,
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cellBg: "bg-emerald-50",
    cellBgHover: "bg-emerald-100",
  },
  incoming: {
    label: "入金",
    required: false,
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cellBg: "bg-emerald-50",
    cellBgHover: "bg-emerald-100",
  },
  outgoing: {
    label: "出金",
    required: false,
    chip: "bg-rose-100 text-rose-800 border-rose-300",
    cellBg: "bg-rose-50",
    cellBgHover: "bg-rose-100",
  },
  balance: {
    label: "残高",
    required: false,
    chip: "bg-amber-100 text-amber-800 border-amber-300",
    cellBg: "bg-amber-50",
    cellBgHover: "bg-amber-100",
  },
};

export function MappingScreen({
  imported,
  initialMapping,
  initialBankInfo,
  templateMatched,
  onConfirm,
  onBack,
}: Props) {
  const [date, setDate] = useState<number | null>(initialMapping?.date ?? null);
  const [summary, setSummary] = useState<number[]>(
    initialMapping?.summary ?? [],
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
    initialMapping?.incoming ?? null,
  );
  const [outgoing, setOutgoing] = useState<number | null>(
    initialMapping?.outgoing ?? null,
  );

  const [bankName, setBankName] = useState(initialBankInfo?.bankName ?? "");
  const [accountName, setAccountName] = useState(
    initialBankInfo?.accountName ?? "",
  );

  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [knownAccounts, setKnownAccounts] = useState<KnownAccount[]>([]);

  useEffect(() => {
    void listKnownAccounts().then(setKnownAccounts);
  }, []);

  const previewRows = useMemo(
    () => imported.rawRows.slice(0, PREVIEW_ROW_COUNT),
    [imported.rawRows],
  );

  const roles = useMemo<RoleDef[]>(() => {
    const order: RoleKey[] =
      amountStyle === "single"
        ? ["date", "summary", "amount", "balance"]
        : ["date", "summary", "incoming", "outgoing", "balance"];
    return order.map((key) => ({ key, ...ROLE_DEFS[key] }));
  }, [amountStyle]);

  function getColumnsForRole(role: RoleKey): number[] {
    switch (role) {
      case "date":
        return date !== null ? [date] : [];
      case "summary":
        return summary;
      case "amount":
        return amount !== null ? [amount] : [];
      case "incoming":
        return incoming !== null ? [incoming] : [];
      case "outgoing":
        return outgoing !== null ? [outgoing] : [];
      case "balance":
        return balance !== null ? [balance] : [];
    }
  }

  function setSingleRoleValue(role: RoleKey, value: number | null) {
    switch (role) {
      case "date":
        setDate(value);
        break;
      case "amount":
        setAmount(value);
        break;
      case "incoming":
        setIncoming(value);
        break;
      case "outgoing":
        setOutgoing(value);
        break;
      case "balance":
        setBalance(value);
        break;
    }
  }

  function clearOtherRolesOnColumn(columnIndex: number, except: RoleKey) {
    if (except !== "date" && date === columnIndex) setDate(null);
    if (except !== "amount" && amount === columnIndex) setAmount(null);
    if (except !== "incoming" && incoming === columnIndex) setIncoming(null);
    if (except !== "outgoing" && outgoing === columnIndex) setOutgoing(null);
    if (except !== "balance" && balance === columnIndex) setBalance(null);
    if (except !== "summary" && summary.includes(columnIndex)) {
      setSummary(summary.filter((i) => i !== columnIndex));
    }
  }

  function rolesForColumn(columnIndex: number): RoleDef[] {
    return roles.filter((r) => getColumnsForRole(r.key).includes(columnIndex));
  }

  function handleRoleClick(role: RoleKey) {
    setSelectedRole((prev) => (prev === role ? null : role));
  }

  function handleColumnClick(columnIndex: number) {
    if (!selectedRole) return;

    if (selectedRole === "summary") {
      if (summary.includes(columnIndex)) {
        setSummary(summary.filter((i) => i !== columnIndex));
      } else {
        setSummary([...summary, columnIndex].sort((a, b) => a - b));
        clearOtherRolesOnColumn(columnIndex, "summary");
      }
      return;
    }

    clearOtherRolesOnColumn(columnIndex, selectedRole);
    setSingleRoleValue(selectedRole, columnIndex);
    setSelectedRole(null);
  }

  function clearRole(role: RoleKey) {
    if (role === "summary") {
      setSummary([]);
    } else {
      setSingleRoleValue(role, null);
    }
  }

  function changeAmountStyle(style: AmountStyle) {
    if (style === amountStyle) return;
    setAmountStyle(style);
    if (style === "single") {
      setIncoming(null);
      setOutgoing(null);
    } else {
      setAmount(null);
    }
    if (selectedRole === "amount" && style === "split") setSelectedRole(null);
    if (
      (selectedRole === "incoming" || selectedRole === "outgoing") &&
      style === "single"
    ) {
      setSelectedRole(null);
    }
  }

  const requiredOk = roles.every((r) => {
    if (!r.required) return true;
    return getColumnsForRole(r.key).length > 0;
  });
  const canSubmit =
    requiredOk && bankName.trim() !== "" && accountName.trim() !== "";

  function handleSubmit() {
    if (!canSubmit) return;
    onConfirm(
      {
        date: date ?? 0,
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
      <header className="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              CSVファイルの列を設定
            </h1>
            <p className="mt-0.5 text-xs text-gray-600">
              アップロードした「{imported.fileName}」の各列が「日付」「摘要」「金額」などのどれにあたるかを設定してください。摘要は複数列を割り当てることもできます。
            </p>
          </div>
          {templateMatched && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-semibold text-emerald-800">
              登録済みテンプレートを自動適用しました
            </span>
          )}
        </div>

        {knownAccounts.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
            <span className="text-[11px] font-semibold text-blue-800">
              過去に登録した口座から選択:
            </span>
            <select
              value=""
              onChange={(e) => {
                const idx = e.target.value;
                if (idx === "") return;
                const a = knownAccounts[Number(idx)];
                if (!a) return;
                setBankName(a.bankName);
                setAccountName(a.accountName);
              }}
              className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">選択してください...</option>
              {knownAccounts.map((a, idx) => (
                <option key={idx} value={idx}>
                  {a.bankName}
                  {a.accountName ? ` / 口座番号 ${a.accountName}` : ""}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-blue-700">
              選ぶと銀行名・口座番号が自動入力されます
            </span>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="md:col-span-3">
            <span className="mb-1 block text-[11px] font-semibold text-gray-700">
              銀行名 *
            </span>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="例: 楽天銀行"
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="md:col-span-3">
            <span className="mb-1 block text-[11px] font-semibold text-gray-700">
              口座番号 *
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="例: 1234567"
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <div className="md:col-span-6">
            <span className="mb-1 block text-[11px] font-semibold text-gray-700">
              金額の入力方式
            </span>
            <div className="flex gap-3 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="amount-style"
                  checked={amountStyle === "split"}
                  onChange={() => changeAmountStyle("split")}
                />
                入金列・出金列の2列
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="amount-style"
                  checked={amountStyle === "single"}
                  onChange={() => changeAmountStyle("single")}
                />
                金額1列（正負で区別）
              </label>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-700">役割:</span>
          {roles.map((r) => {
            const cols = getColumnsForRole(r.key);
            const mapped = cols.length > 0;
            const active = selectedRole === r.key;
            const statusText = mapped
              ? cols
                  .map(
                    (i) => `${i + 1}列目「${imported.headers[i] || "(空)"}」`,
                  )
                  .join(", ")
              : "未設定";
            return (
              <span
                key={r.key}
                className={`inline-flex items-stretch rounded-full border text-xs transition ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-300"
                    : mapped
                      ? r.chip
                      : "border-dashed border-gray-300 bg-white text-gray-500"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleRoleClick(r.key)}
                  className="flex items-center gap-1 rounded-l-full px-3 py-1 hover:bg-black/5"
                >
                  <span className="font-semibold">
                    {r.label}
                    {r.required && <span className="text-red-500">*</span>}
                    {r.key === "summary" && cols.length > 1 && (
                      <span className="ml-0.5 text-[10px] font-normal opacity-70">
                        ({cols.length})
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] opacity-80">{statusText}</span>
                </button>
                <button
                  type="button"
                  aria-label="この割当を解除"
                  title="この割当を解除"
                  onClick={() => clearRole(r.key)}
                  className={`flex items-center border-l border-black/10 px-2 text-[11px] hover:bg-black/10 rounded-r-full ${
                    mapped ? "" : "invisible w-0 border-l-0 px-0"
                  }`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        <div className="mt-2 text-[11px] text-gray-600">
          {selectedRole === "summary" ? (
            <span className="font-semibold text-violet-700">
              選択中: 摘要 →
              プレビューで列をクリックすると追加されます。複数列を選択でき、もう一度クリックすると外せます。終わったら別の役割を選ぶか「摘要」をもう一度クリック。
            </span>
          ) : selectedRole ? (
            <span className="font-semibold text-blue-700">
              選択中: {ROLE_DEFS[selectedRole].label} →
              下のプレビューの列ヘッダー（または列内のセル）をクリックして割り当ててください。もう一度同じ役割をクリックすると解除できます。
            </span>
          ) : (
            <span>
              役割ボタンをクリックして選択し、下のプレビューの該当列をクリックすると割り当てられます。
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="w-12 border-b border-r border-gray-200 px-2 py-2 text-right text-[10px] font-medium text-gray-500">
                  #
                </th>
                {imported.headers.map((h, idx) => {
                  const mappedRoles = rolesForColumn(idx);
                  const clickable = selectedRole !== null;
                  return (
                    <th
                      key={idx}
                      onClick={() => handleColumnClick(idx)}
                      onMouseEnter={() => setHoveredColumn(idx)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      className={`min-w-[140px] border-b border-r border-gray-200 px-3 py-2 text-left font-medium last:border-r-0 ${
                        clickable
                          ? "cursor-pointer hover:bg-blue-100/40"
                          : "cursor-default"
                      }`}
                    >
                      <div className="text-[10px] text-gray-500">
                        {idx + 1}列目
                      </div>
                      <div className="text-gray-800">{h || "(空)"}</div>
                      <div className="mt-1 flex min-h-[18px] flex-wrap gap-1">
                        {mappedRoles.map((r) => (
                          <span
                            key={r.key}
                            className={`inline-block rounded-full border px-1.5 text-[10px] ${r.chip}`}
                          >
                            {r.label}
                          </span>
                        ))}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, ridx) => (
                <tr key={ridx} className="border-t border-gray-100">
                  <td className="border-r border-gray-100 px-2 py-1 text-right text-[10px] text-gray-400">
                    {ridx + 1}
                  </td>
                  {imported.headers.map((_, cidx) => {
                    const mappedRoles = rolesForColumn(cidx);
                    const role = mappedRoles[0];
                    const clickable = selectedRole !== null;
                    const isHovered = hoveredColumn === cidx;
                    let cellBg = "bg-white";
                    if (role) {
                      cellBg = isHovered ? role.cellBgHover : role.cellBg;
                    } else if (clickable && isHovered) {
                      cellBg = "bg-blue-100/40";
                    }
                    return (
                      <td
                        key={cidx}
                        onClick={() => handleColumnClick(cidx)}
                        onMouseEnter={() => setHoveredColumn(cidx)}
                        onMouseLeave={() => setHoveredColumn(null)}
                        className={`whitespace-nowrap border-r border-gray-100 px-3 py-1 last:border-r-0 ${cellBg} ${
                          clickable ? "cursor-pointer" : ""
                        }`}
                      >
                        {row[cidx] ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <footer className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={onBack}
        >
          戻る
        </button>
        <div className="flex items-center gap-3">
          {!canSubmit && (
            <span className="text-[11px] text-gray-500">
              {bankName.trim() === ""
                ? "銀行名を入力してください"
                : accountName.trim() === ""
                  ? "口座番号を入力してください"
                  : "必須の役割（*印）を割り当ててください"}
            </span>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            この設定で編集を開始
          </button>
        </div>
      </footer>
    </div>
  );
}
