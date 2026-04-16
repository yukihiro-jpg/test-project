import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { FileStore } from './file-store'
import { exportCashLedgerExcel, exportBankBookExcel } from './excel-export'

let mainWindow: BrowserWindow | null = null
let fileStore: FileStore | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '帳簿管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function setupIpcHandlers() {
  // --- Config ---
  ipcMain.handle('store:read-config', async () => {
    return fileStore!.readConfig()
  })

  ipcMain.handle('store:save-config', async (_event, config) => {
    fileStore!.saveConfig(config)
    fileStore = new FileStore(config.dataFolder)
  })

  ipcMain.handle('store:has-config', async () => {
    return fileStore!.hasConfig()
  })

  // --- Cash Ledger ---
  ipcMain.handle('store:read-cash-month', async (_event, month: string) => {
    return fileStore!.readCashMonth(month)
  })

  ipcMain.handle('store:save-cash-month', async (_event, data) => {
    fileStore!.saveCashMonth(data)
  })

  ipcMain.handle('store:list-cash-months', async () => {
    return fileStore!.listCashMonths()
  })

  // --- Bank Book ---
  ipcMain.handle('store:read-bank-month', async (_event, accountId: string, month: string) => {
    return fileStore!.readBankMonth(accountId, month)
  })

  ipcMain.handle('store:save-bank-month', async (_event, data) => {
    fileStore!.saveBankMonth(data)
  })

  ipcMain.handle('store:list-bank-months', async (_event, accountId: string) => {
    return fileStore!.listBankMonths(accountId)
  })

  // --- Bank Accounts ---
  ipcMain.handle('store:read-bank-accounts', async () => {
    return fileStore!.readBankAccounts()
  })

  ipcMain.handle('store:save-bank-accounts', async (_event, accounts) => {
    fileStore!.saveBankAccounts(accounts)
  })

  // --- Suggestions ---
  ipcMain.handle('store:read-suggestions', async () => {
    return fileStore!.readSuggestions()
  })

  ipcMain.handle('store:save-suggestions', async (_event, data) => {
    fileStore!.saveSuggestions(data)
  })

  // --- Excel Export ---
  ipcMain.handle('export:cash-ledger', async (_event, month: string, companyName: string) => {
    const data = fileStore!.readCashMonth(month)
    if (!data) return null
    const defaultPath = path.join(
      fileStore!.getExportsDir(),
      `現金出納帳_${month}.xlsx`
    )
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return null
    await exportCashLedgerExcel(data, companyName, result.filePath)
    return result.filePath
  })

  ipcMain.handle('export:bank-book', async (_event, accountId: string, month: string, companyName: string, accountName: string) => {
    const data = fileStore!.readBankMonth(accountId, month)
    if (!data) return null
    const defaultPath = path.join(
      fileStore!.getExportsDir(),
      `通帳_${accountName}_${month}.xlsx`
    )
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return null
    await exportBankBookExcel(data, companyName, accountName, result.filePath)
    return result.filePath
  })

  // --- Dialogs ---
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'データ保存先フォルダを選択',
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })
}

app.whenReady().then(() => {
  const defaultDataDir = path.join(app.getPath('desktop'), '帳簿データ')
  fileStore = new FileStore(defaultDataDir)
  setupIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
