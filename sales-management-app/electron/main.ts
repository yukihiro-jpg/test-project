import { app, BrowserWindow, safeStorage } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { openDatabase, type AppDb } from '../src/shared/db/client';
import { registerIpc } from './ipc';

let mainWindow: BrowserWindow | null = null;
export let db: AppDb;
export let pdfDir: string;
export let dbPath: string;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  dbPath = path.join(userData, 'sales.db');
  pdfDir = path.join(userData, 'pdfs');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  db = openDatabase(dbPath);

  registerIpc({ db, safeStorage: safeStorage as any, dbPath, pdfDir });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
