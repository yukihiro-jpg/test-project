import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-red-50 p-8">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-red-700">
              アプリで予期しないエラーが発生しました
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {this.state.error.message ||
                "詳細はブラウザの開発者ツール（F12）のコンソールを確認してください。"}
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded bg-gray-50 p-3 text-[11px] text-gray-700">
              {this.state.error.stack ?? ""}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                ホームへ戻る（リトライ）
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ページを再読み込み
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
