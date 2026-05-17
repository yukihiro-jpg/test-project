import { contextBridge, ipcRenderer } from 'electron';

// contextBridge は Proxy をクローンできないため、汎用 invoke 関数のみを公開し、
// レンダラ側 (src/renderer/api.ts) で window.api を Proxy で組み立てる。
contextBridge.exposeInMainWorld('rpc', {
  invoke: (module: string, method: string, ...args: any[]) =>
    ipcRenderer.invoke('rpc', { module, method, args })
});
