interface ApiNamespace {
  [method: string]: (...args: any[]) => Promise<any>;
}

interface Window {
  api: {
    customers: ApiNamespace;
    suppliers: ApiNamespace;
    products: ApiNamespace;
    bankAccounts: ApiNamespace;
    deliveries: ApiNamespace;
    salesInvoices: ApiNamespace;
    purchaseInvoices: ApiNamespace;
    payments: ApiNamespace;
    cashflow: ApiNamespace;
    arAging: ApiNamespace;
    apAging: ApiNamespace;
    inventory: ApiNamespace;
    backup: ApiNamespace;
    settings: ApiNamespace;
    dashboard: ApiNamespace;
    pdf: ApiNamespace;
  };
}
