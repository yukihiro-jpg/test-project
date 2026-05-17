import { contextBridge, ipcRenderer } from 'electron';

const invoke = (module: string, method: string, ...args: any[]) =>
  ipcRenderer.invoke('rpc', { module, method, args });

const make = (mod: string) => new Proxy({}, {
  get: (_t, prop: string) => (...args: any[]) => invoke(mod, prop, ...args)
});

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

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
