import { useState } from "react";
import { ImportScreen } from "./components/ImportScreen";
import { MappingScreen } from "./components/MappingScreen";
import { EditorScreen } from "./components/EditorScreen";
import type {
  BankInfo,
  ColumnMapping,
  ImportedCsv,
} from "./types";

type Step = "import" | "mapping" | "editor";

function App() {
  const [step, setStep] = useState<Step>("import");
  const [imported, setImported] = useState<ImportedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);

  if (step === "import") {
    return (
      <div className="h-full">
        <ImportScreen
          onImported={(im) => {
            setImported(im);
            setStep("mapping");
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
          onConfirm={(m, info) => {
            setMapping(m);
            setBankInfo(info);
            setStep("editor");
          }}
          onBack={() => {
            setImported(null);
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
          onBack={() => setStep("mapping")}
        />
      </div>
    );
  }

  return null;
}

export default App;
