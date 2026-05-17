import type { AppDb } from '../db/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import archiver from 'archiver';
import unzipper from 'unzipper';

export interface BackupContext {
  dbPath: string;
  pdfDir: string;
}

export async function exportAll(_db: AppDb, ctx: BackupContext, outputZipPath: string): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);
    if (fs.existsSync(ctx.dbPath)) archive.file(ctx.dbPath, { name: 'sales.db' });
    if (fs.existsSync(ctx.pdfDir)) archive.directory(ctx.pdfDir, 'pdfs');
    archive.finalize();
  });
  return outputZipPath;
}

export async function restoreFromZip(_db: AppDb, ctx: BackupContext, zipPath: string): Promise<void> {
  const tmp = path.join(path.dirname(ctx.dbPath), 'restore-tmp');
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: tmp }))
      .on('close', () => resolve())
      .on('error', reject);
  });
  const restoredDb = path.join(tmp, 'sales.db');
  if (fs.existsSync(restoredDb)) {
    fs.copyFileSync(restoredDb, ctx.dbPath);
  }
  const restoredPdfs = path.join(tmp, 'pdfs');
  if (fs.existsSync(restoredPdfs)) {
    if (fs.existsSync(ctx.pdfDir)) fs.rmSync(ctx.pdfDir, { recursive: true, force: true });
    fs.mkdirSync(ctx.pdfDir, { recursive: true });
    fs.cpSync(restoredPdfs, ctx.pdfDir, { recursive: true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
