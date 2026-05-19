// ===== データ層 (localStorage) =====
const STORAGE_KEY = 'kaigo-app-v1';

const defaultState = {
  services: [
    { id: cryptoId(), name: '訪問介護' },
    { id: cryptoId(), name: '通所介護（デイサービス）' },
    { id: cryptoId(), name: '居宅介護支援' },
    { id: cryptoId(), name: '福祉用具貸与' },
  ],
  clients: [],
  entries: [],
};

function cryptoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return JSON.parse(JSON.stringify(defaultState));
  try {
    const s = JSON.parse(raw);
    if (!s.services || !s.clients || !s.entries) return JSON.parse(JSON.stringify(defaultState));
    return s;
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadState();

// ===== ユーティリティ =====
const fmtYen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2200);
}

const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const labelYm = (ym) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};
const prevYm = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return ymOf(d);
};
const nextYm = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return ymOf(d);
};
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== 状態 =====
let currentYm = ymOf(new Date());
let currentView = 'dashboard';

const viewTitles = {
  dashboard: 'ダッシュボード',
  entry: '売上入力',
  clients: '利用者マスタ',
  services: 'サービス分類',
};

// ===== ビュー切替 =====
function switchView(view) {
  currentView = view;
  $$('.nav-item').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  $('#pageTitle').textContent = viewTitles[view] || '';
  renderCurrent();
}
$$('.nav-item').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
$$('[data-jump]').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.jump)));

// ===== 月切替 =====
function setMonth(ym) {
  currentYm = ym;
  $('#currentMonthLabel').textContent = labelYm(ym);
  renderCurrent();
}
$('#prevMonth').addEventListener('click', () => setMonth(prevYm(currentYm)));
$('#nextMonth').addEventListener('click', () => setMonth(nextYm(currentYm)));

// ===== モーダル =====
function openModal(id) {
  const m = document.getElementById(id);
  m.hidden = false;
  // セレクト類を最新に
  if (id === 'entryModal') refreshEntrySelects();
  // 入力欄リセット
  if (id === 'entryModal') {
    $('#entryAmount').value = '';
    $('#entryNote').value = '';
    $('#entryDate').value = '';
  }
  if (id === 'clientModal') { $('#clientName').value = ''; $('#clientCare').value = ''; $('#clientNote').value = ''; }
  if (id === 'serviceModal') { $('#serviceName').value = ''; }
  // フォーカス
  setTimeout(() => {
    const firstInput = m.querySelector('input:not([type="radio"]), select');
    firstInput && firstInput.focus();
  }, 50);
}
function closeModal(m) { m.hidden = true; }
$$('.modal').forEach((m) => {
  m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(m)));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $$('.modal').forEach((m) => (m.hidden = true));
});

$('#openEntryModal').addEventListener('click', () => openModal('entryModal'));
$('#openClientModal').addEventListener('click', () => openModal('clientModal'));
$('#openServiceModal').addEventListener('click', () => openModal('serviceModal'));

// ===== 描画 =====
function renderCurrent() {
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'entry') renderEntry();
  if (currentView === 'clients') renderClients();
  if (currentView === 'services') renderServices();
}

function refreshEntrySelects() {
  const clientSel = $('#entryClient');
  const serviceSel = $('#entryService');
  clientSel.innerHTML = '<option value="">選択してください</option>' +
    state.clients.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  serviceSel.innerHTML = '<option value="">選択してください</option>' +
    state.services.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

function entriesOfMonth(ym) { return state.entries.filter((e) => e.ym === ym); }
function nameOfClient(id) { return state.clients.find((c) => c.id === id)?.name || '(削除済み)'; }
function nameOfService(id) { return state.services.find((s) => s.id === id)?.name || '(削除済み)'; }

// ===== ダッシュボード =====
function renderDashboard() {
  const cur = entriesOfMonth(currentYm);
  const prev = entriesOfMonth(prevYm(currentYm));
  const total = cur.reduce((a, e) => a + Number(e.amount || 0), 0);
  const prevTotal = prev.reduce((a, e) => a + Number(e.amount || 0), 0);
  $('#kpiTotal').textContent = fmtYen(total);
  $('#kpiCount').textContent = `${cur.length} 件`;
  $('#kpiClients').textContent = `利用者 ${new Set(cur.map((e) => e.clientId)).size} 名`;
  $('#kpiAvg').textContent = fmtYen(cur.length ? Math.round(total / cur.length) : 0);
  const diffEl = $('#kpiDiff');
  if (prevTotal === 0) {
    diffEl.textContent = '前月比 ―';
    diffEl.style.color = '';
  } else {
    const diff = total - prevTotal;
    const pct = ((diff / prevTotal) * 100).toFixed(1);
    diffEl.textContent = `前月比 ${diff >= 0 ? '+' : ''}${pct}% (${fmtYen(diff)})`;
    diffEl.style.color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
  }

  const byService = new Map();
  cur.forEach((e) => byService.set(e.serviceId, (byService.get(e.serviceId) || 0) + Number(e.amount || 0)));
  const max = Math.max(1, ...byService.values());
  const breakdownEl = $('#serviceBreakdown');
  if (byService.size === 0) {
    breakdownEl.innerHTML = '<div class="empty">当月のデータがありません</div>';
  } else {
    breakdownEl.innerHTML = [...byService.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sid, amt]) => `
        <div class="breakdown-row">
          <div class="breakdown-name">${escapeHtml(nameOfService(sid))}</div>
          <div class="breakdown-bar-bg"><div class="breakdown-bar" style="width:${(amt / max) * 100}%"></div></div>
          <div class="breakdown-amount">${fmtYen(amt)}</div>
        </div>`).join('');
  }

  const byClient = new Map();
  cur.forEach((e) => byClient.set(e.clientId, (byClient.get(e.clientId) || 0) + Number(e.amount || 0)));
  const rankEl = $('#clientRanking');
  if (byClient.size === 0) {
    rankEl.innerHTML = '<div class="empty">当月のデータがありません</div>';
  } else {
    rankEl.innerHTML = [...byClient.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cid, amt], i) => `
        <div class="rank-row">
          <div class="rank-num">${i + 1}</div>
          <div class="rank-name">${escapeHtml(nameOfClient(cid))}</div>
          <div class="rank-amount">${fmtYen(amt)}</div>
        </div>`).join('');
  }
}

// ===== 売上入力 =====
$$('input[name="entryMode"]').forEach((r) => {
  r.addEventListener('change', () => {
    const daily = document.querySelector('input[name="entryMode"]:checked').value === 'daily';
    $('#entryDateField').style.display = daily ? '' : 'none';
    $('#entryDate').required = daily;
  });
});

$('#entryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const clientId = $('#entryClient').value;
  const serviceId = $('#entryService').value;
  const amount = Number($('#entryAmount').value);
  const note = $('#entryNote').value;
  const mode = document.querySelector('input[name="entryMode"]:checked').value;
  const dateVal = $('#entryDate').value;
  if (!clientId || !serviceId || !amount) return;

  let ym = currentYm;
  let date = null;
  if (mode === 'daily') {
    if (!dateVal) return;
    date = dateVal;
    ym = dateVal.slice(0, 7);
  }
  state.entries.push({ id: cryptoId(), clientId, serviceId, amount, note, mode, ym, date });
  saveState();
  closeModal($('#entryModal'));
  toast('記録しました');
  renderCurrent();
});

$('#copyPrevMonth').addEventListener('click', () => {
  const prev = entriesOfMonth(prevYm(currentYm));
  if (prev.length === 0) { toast('先月のデータがありません'); return; }
  if (!confirm(`先月の ${prev.length} 件を当月にコピーします。よろしいですか？`)) return;
  prev.forEach((e) => {
    state.entries.push({
      id: cryptoId(),
      clientId: e.clientId,
      serviceId: e.serviceId,
      amount: e.amount,
      note: e.note,
      mode: e.mode,
      ym: currentYm,
      date: e.date ? currentYm + e.date.slice(7) : null,
    });
  });
  saveState();
  toast(`${prev.length} 件コピーしました`);
  renderEntry();
});

function renderEntry() {
  const tbody = $('#entryTbody');
  const rows = entriesOfMonth(currentYm).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">当月のデータがありません。「新規記録」または「先月分をコピー」から始めましょう。</td></tr>';
  } else {
    tbody.innerHTML = rows.map((e) => `
      <tr>
        <td>${e.date ? e.date : '<span style="color:var(--text-soft)">月単位</span>'}</td>
        <td>${escapeHtml(nameOfClient(e.clientId))}</td>
        <td>${escapeHtml(nameOfService(e.serviceId))}</td>
        <td class="num">${fmtYen(e.amount)}</td>
        <td style="color:var(--text-muted)">${escapeHtml(e.note || '')}</td>
        <td><button class="btn-link-danger" data-del="${e.id}">削除</button></td>
      </tr>`).join('');
  }
  const total = rows.reduce((a, e) => a + Number(e.amount || 0), 0);
  $('#entryTotal').textContent = fmtYen(total);
  tbody.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!confirm('この記録を削除しますか？')) return;
      state.entries = state.entries.filter((x) => x.id !== b.dataset.del);
      saveState();
      renderEntry();
    });
  });
}

// ===== 利用者 =====
$('#clientForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#clientName').value.trim();
  const care = $('#clientCare').value;
  const note = $('#clientNote').value.trim();
  if (!name) return;
  state.clients.push({ id: cryptoId(), name, care, note });
  saveState();
  closeModal($('#clientModal'));
  toast('利用者を追加しました');
  renderClients();
});

function renderClients() {
  const tbody = $('#clientTbody');
  if (state.clients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">利用者がまだ登録されていません。右上の「利用者を追加」から始めましょう。</td></tr>';
    return;
  }
  tbody.innerHTML = state.clients.map((c) => `
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>${escapeHtml(c.care || '―')}</td>
      <td style="color:var(--text-muted)">${escapeHtml(c.note || '')}</td>
      <td><button class="btn-link-danger" data-del-client="${c.id}">削除</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-del-client]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.delClient;
      const used = state.entries.some((e) => e.clientId === id);
      if (used && !confirm('この利用者の売上記録も削除されます。続行しますか？')) return;
      if (!used && !confirm('この利用者を削除しますか？')) return;
      state.entries = state.entries.filter((e) => e.clientId !== id);
      state.clients = state.clients.filter((c) => c.id !== id);
      saveState();
      renderClients();
    });
  });
}

// ===== サービス分類 =====
$('#serviceForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#serviceName').value.trim();
  if (!name) return;
  if (state.services.some((s) => s.name === name)) { toast('同じ名前の分類が既にあります'); return; }
  state.services.push({ id: cryptoId(), name });
  saveState();
  closeModal($('#serviceModal'));
  toast('分類を追加しました');
  renderServices();
});

function renderServices() {
  const tbody = $('#serviceTbody');
  tbody.innerHTML = state.services.map((s) => {
    const count = state.entries.filter((e) => e.serviceId === s.id).length;
    return `<tr>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td style="color:var(--text-muted)">${count} 件</td>
      <td><button class="btn-link-danger" data-del-service="${s.id}">削除</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-del-service]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.delService;
      const count = state.entries.filter((e) => e.serviceId === id).length;
      const msg = count > 0
        ? `この分類を使った売上記録が ${count} 件あります。削除すると分類名が「(削除済み)」と表示されますが、データは残ります。削除しますか？`
        : 'この分類を削除しますか？';
      if (!confirm(msg)) return;
      state.services = state.services.filter((s) => s.id !== id);
      saveState();
      renderServices();
    });
  });
}

// ===== Excel出力 =====
$('#exportBtn').addEventListener('click', () => {
  const rows = entriesOfMonth(currentYm);
  if (rows.length === 0) { toast('当月のデータがありません'); return; }
  const wb = XLSX.utils.book_new();

  const detail = rows.map((e) => ({
    日付: e.date || '(月単位)',
    利用者: nameOfClient(e.clientId),
    サービス分類: nameOfService(e.serviceId),
    金額: Number(e.amount || 0),
    備考: e.note || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), '明細');

  const byClient = new Map();
  rows.forEach((e) => byClient.set(e.clientId, (byClient.get(e.clientId) || 0) + Number(e.amount || 0)));
  const summary1 = [...byClient.entries()].sort((a, b) => b[1] - a[1])
    .map(([cid, amt]) => ({ 利用者: nameOfClient(cid), 金額: amt }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary1), '利用者別');

  const byService = new Map();
  rows.forEach((e) => byService.set(e.serviceId, (byService.get(e.serviceId) || 0) + Number(e.amount || 0)));
  const summary2 = [...byService.entries()].sort((a, b) => b[1] - a[1])
    .map(([sid, amt]) => ({ サービス分類: nameOfService(sid), 金額: amt }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary2), 'サービス別');

  XLSX.writeFile(wb, `売上_${currentYm}.xlsx`);
  toast('Excelを書き出しました');
});

// ===== 初期化 =====
setMonth(currentYm);
switchView('dashboard');
