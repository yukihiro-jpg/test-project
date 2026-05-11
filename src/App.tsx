import { useState } from "react";
import { ImportScreen } from "./components/ImportScreen";
import { MappingScreen } from "./components/MappingScreen";
import { EditorScreen } from "./components/EditorScreen";
import { HomeScreen } from "./components/HomeScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  findTemplateBySignature,
  upsertTemplate,
  type ImportSession,
} from "./lib/db";
import type {
  BankInfo,
  ColumnMapping,
  ImportedCsv,
  TransactionRow,
} from "./types";

type Step = "home" | "import" | "mapping" | "editor" | "settings";

function AppInner() {
  const [step, setStep] = useState<Step>("home");
  const [imported, setImported] = useState<ImportedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [initialMapping, setInitialMapping] = useState<ColumnMapping | null>(
    null,
  );
  const [initialBankInfo, setInitialBankInfo] = useState<BankInfo | null>(null);
  const [templateMatched, setTemplateMatched] = useState(false);
  const [resumeRows, setResumeRows] = useState<TransactionRow[] | null>(null);
  const [resumeSelectedRow, setResumeSelectedRow] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  function resetWorkState() {
    setImported(null);
    setMapping(null);
    setBankInfo(null);
    setInitialMapping(null);
    setInitialBankInfo(null);
    setTemplateMatched(false);
    setResumeRows(null);
    setResumeSelectedRow(0);
    setSessionId(null);
  }

  async function handleImported(im: ImportedCsv) {
    setImported(im);
    const tpl = await findTemplateBySignature(im.headers);
    if (tpl) {
      setInitialMapping(tpl.columnMap);
      setInitialBankInfo({ bankName: tpl.name, accountName: "" });
      setTemplateMatched(true);
    } else {
      setInitialMapping(null);
      setInitialBankInfo(null);
      setTemplateMatched(false);
    }
    setStep("mapping");
  }

  async function handleMappingConfirm(m: ColumnMapping, info: BankInfo) {
    setMapping(m);
    setBankInfo(info);
    await upsertTemplate(info.bankName, imported?.headers ?? [], m);
    setStep("editor");
  }

  function handleResume(session: ImportSession) {
    setImported({
      fileName: session.imported.fileName,
      encoding: session.imported.encoding,
      headers: session.imported.headers,
      rawRows: session.imported.rawRows,
      originalBytes: session.imported.originalBytes,
    });
    setMapping(session.mapping);
    setBankInfo(session.bankInfo);
    setResumeRows(session.rows);
    setResumeSelectedRow(session.selectedRow);
    setSessionId(session.id);
    setStep("editor");
  }

  function handleBackToHome() {
    resetWorkState();
    setStep("home");
  }

  if (step === "home") {
    return (
      <div className="h-full">
        <HomeScreen
          onNewImport={() => {
            resetWorkState();
            setStep("import");
          }}
          onResume={handleResume}
          onOpenSettings={() => setStep("settings")}
        />
      </div>
    );
  }

  if (step === "settings") {
    return (
      <div className="h-full">
        <SettingsScreen onBack={() => setStep("home")} />
      </div>
    );
  }

  if (step === "import") {
    return (
      <div className="h-full">
        <ImportScreen
          onImported={(im) => {
            void handleImported(im);
          }}
        />
      </div>
    );
  }

  if (step === "mapping" && imported) {
    return (
      <div className="h-full">
        <MappingScreen
          imported={imported}
          initialMapping={initialMapping}
          initialBankInfo={initialBankInfo}
          templateMatched={templateMatched}
          onConfirm={(m, info) => {
            void handleMappingConfirm(m, info);
          }}
          onBack={() => {
            resetWorkState();
            setStep("import");
          }}
        />
      </div>
    );
  }

  if (step === "editor" && imported && mapping && bankInfo) {
    return (
      <div className="h-full">
        <EditorScreen
          imported={imported}
          mapping={mapping}
          bankInfo={bankInfo}
          initialRows={resumeRows}
          initialSelectedRow={resumeSelectedRow}
          sessionId={sessionId}
          onBack={handleBackToHome}
          onCompleted={handleBackToHome}
        />
      </div>
    );
  }

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

export default App;
