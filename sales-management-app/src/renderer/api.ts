// preload.ts は window.rpc.invoke(module, method, ...args) のみを公開する。
// レンダラ側でこれをラップして、各サービスのメソッド呼び出しを Proxy で透過的に渡す。
const rpc = (window as any).rpc as {
  invoke: (module: string, method: string, ...args: any[]) => Promise<any>;
};

function make(mod: string): any {
  return new Proxy(
    {},
    {
      get: (_t, prop: string) =>
        (...args: any[]) =>
          rpc.invoke(mod, prop, ...args)
    }
  );
}

const api = {
  customers: make('customers'),
  suppliers: make('suppliers'),
  products: make('products'),
  bankAccounts: make('bankAccounts'),
  deliveries: make('deliveries'),
  salesInvoices: make('salesInvoices'),
  purchaseInvoices: make('purchaseInvoices'),
  payments: make('payments'),
  cashflow: make('cashflow'),
  arAging: make('arAging'),
  apAging: make('apAging'),
  inventory: make('inventory'),
  backup: make('backup'),
  settings: make('settings'),
  dashboard: make('dashboard'),
  pdf: make('pdf')
};

// 既存ページが window.api.* を参照しているため互換維持
(window as any).api = api;

export default api;
