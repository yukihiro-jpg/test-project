// vendor/better-sqlite3 のスタブを node_modules/better-sqlite3 に必ず展開する。
// npm の file: 依存が Windows で正しく解決されないケースを回避するためのインストール後フック。
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'vendor', 'better-sqlite3');
const dest = path.join(root, 'node_modules', 'better-sqlite3');

if (!fs.existsSync(src)) {
  console.error('[install-sqlite-stub] vendor/better-sqlite3 が見つかりません');
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });

// 既存を削除（シンボリックリンクや古いコピーを除去）
if (fs.existsSync(dest) || fs.lstatSync(dest, { throwIfNoEntry: false })) {
  try {
    fs.rmSync(dest, { recursive: true, force: true });
  } catch {}
}

fs.mkdirSync(dest, { recursive: true });
for (const file of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log('[install-sqlite-stub] node_modules/better-sqlite3 にスタブを設置しました');
