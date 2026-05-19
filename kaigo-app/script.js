// ===== データ層 (localStorage) =====
const STORAGE_KEY = 'kaigo-app-v1';

const defaultState = {
  services: [
    { id: crypto.randomUUID(), name: '訪問介護' },
    { id: crypto.randomUUID(), name: '通所介護（デイサービス）' },
    { id: crypto.randomUUID(), name: '居宅介護支援' },
    { id: crypto.randomUUID(), name: '福祉用具貸与' },
  ],
  clients: [],
  // entry: { id, clientId, serviceId, ym: 'YYYY-MM', date: 'YYYY-MM-DD' | null, amount, note, mode }
  entries: [],
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    const s = JSON.parse(raw);
    if (!s.services || !s.clients || !s.entries) return structuredClone(defaultState);
    return s;
  } catch {
    return structuredClone(defaultState);
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadState();

// ===== ユーティリティ =====
const fmtYen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');
const toast = (msg) => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2200);
};
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

// ===== 状態（UI） =====
let currentYm = ymOf(new Date());
let currentView = 'dashboard';

// ===== ビュー切替 =====
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  renderCurrent();
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => switchView(t.dataset.view));
});
document.querySelectorAll('[data-jump]').forEach((b) => {
  b.addEventListener('click', () => switchView(b.dataset.jump));
});

// ===== 月切替 =====
function setMonth(ym) {
  currentYm = ym;
  document.getElementById('currentMonthLabel').textContent = labelYm(ym);
  renderCurrent();
}
document.getElementById('prevMonth').addEventListener('click', () => setMonth(prevYm(currentYm)));
document.getElementById('nextMonth').addEventListener('click', () => setMonth(nextYm(currentYm)));

// ===== 共通描画 =====
function renderCurrent() {
  refreshSelects();
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'entry') renderEntry();
  if (currentView === 'clients') renderClients();
  if (currentView === 'services') renderServices();
}

function refreshSelects() {
  const clientSel = document.getElementById('entryClient');
  const serviceSel = document.getElementById('entryService');
  if (clientSel) {
    const cur = clientSel.value;
    clientSel.innerHTML = '<option value="">利用者を選択</option>' +
      state.clients.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    clientSel.value = cur;
  }
  if (serviceSel) {
    const cur = serviceSel.value;
    serviceSel.innerHTML = '<option value="">サービスを選択</option>' +
      state.services.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    serviceSel.value = cur;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== ダッシュボード =====
function entriesOfMonth(ym) { return state.entries.filter((e) => e.ym === ym); }
function nameOfClient(id) { return state.clients.find((c) => c.id === id)?.name || '(削除済み)'; }
function nameOfService(id) { return state.services.find((s) => s.id === id)?.name || '(削除済み)'; }

function renderDashboard() {
  const cur = entriesOfMonth(currentYm);
  const prev = entriesOfMonth(prevYm(currentYm));
  const total = cur.reduce((a, e) => a + Number(e.amount || 0), 0);
  const prevTotal = prev.reduce((a, e) => a + Number(e.amount || 0), 0);
  document.getElementById('kpiTotal').textContent = fmtYen(total);
  document.getElementById('kpiCount').textContent = `${cur.length} 件`;
  document.getElementById('kpiClients').textContent = `利用者 ${new Set(cur.map((e) => e.clientId)).size} 名`;
  document.getElementById('kpiAvg').textContent = fmtYen(cur.length ? Math.round(total / cur.length) : 0);
  const diffEl = document.getElementById('kpiDiff');
  if (prevTotal === 0) {
    diffEl.textContent = '前月比 ―';
  } else {
    const diff = total - prevTotal;
    const pct = ((diff / prevTotal) * 100).toFixed(1);
    diffEl.textContent = `前月比 ${diff >= 0 ? '+' : ''}${pct}% (${fmtYen(diff)})`;
    diffEl.style.color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
  }

  // サービス分類別
  const byService = new Map();
  cur.forEach((e) => byService.set(e.serviceId, (byService.get(e.serviceId) || 0) + Number(e.amount || 0)));
  const max = Math.max(1, ...byService.values());
  const breakdownEl = document.getElementById('serviceBreakdown');
  if (byService.size === 0) {
    breakdownEl.innerHTML = '<div class="empty">当月のデータがありません</div>';
  } else {
    breakdownEl.innerHTML = [...byService.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sid, amt]) => `
        <div class="breakdown-row">
          <div>${escapeHtml(nameOfService(sid))}</div>
          <div class="breakdown-bar-bg"><div class="breakdown-bar" style="width:${(amt / max) * 100}%"></div></div>
          <div class="breakdown-amount">${fmtYen(amt)}</div>
        </div>`).join('');
  }

  // 利用者別ランキング
  const byClient = new Map();
  cur.forEach((e) => byClient.set(e.clientId, (byClient.get(e.clientId) || 0) + Number(e.amount || 0)));
  const rankEl = document.getElementById('clientRanking');
  if (byClient.size === 0) {
    rankEl.innerHTML = '<div class="empty">当月のデータがありません</div>';
  } else {
    rankEl.innerHTML = [...byClient.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cid, amt], i) => `
        <div class="rank-row">
          <div class="rank-num">${i + 1}</div>
          <div>${escapeHtml(nameOfClient(cid))}</div>
          <div class="rank-amount">${fmtYen(amt)}</div>
        </div>`).join('');
  }
}

// ===== 売上入力 =====
document.querySelectorAll('input[name="entryMode"]').forEach((r) => {
  r.addEventListener('change', () => {
    const daily = document.querySelector('input[name="entryMode"]:checked').value === 'daily';
    document.getElementById('entryDateLabel').style.display = daily ? '' : 'none';
    document.getElementById('entryDate').required = daily;
  });
});

document.getElementById('entryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const clientId = document.getElementById('entryClient').value;
  const serviceId = document.getElementById('entryService').value;
  const amount = Number(document.getElementById('entryAmount').value);
  const note = document.getElementById('entryNote').value;
  const mode = document.querySelector('input[name="entryMode"]:checked').value;
  const dateVal = document.getElementById('entryDate').value;
  if (!clientId || !serviceId || !amount) return;

  let ym = currentYm;
  let date = null;
  if (mode === 'daily') {
    if (!dateVal) return;
    date = dateVal;
    ym = dateVal.slice(0, 7);
  }
  state.entries.push({
    id: crypto.randomUUID(),
    clientId, serviceId, amount, note, mode, ym, date,
  });
  saveState();
  document.getElementById('entryAmount').value = '';
  document.getElementById('entryNote').value = '';
  document.getElementById('entryDate').value = '';
  toast('記録しました');
  renderEntry();
});

document.getElementById('copyPrevMonth').addEventListener('click', () => {
  const prev = entriesOfMonth(prevYm(currentYm));
  if (prev.length === 0) { toast('先月のデータがありません'); return; }
  if (!confirm(`先月の ${prev.length} 件を当月にコピーします。よろしいですか？`)) return;
  prev.forEach((e) => {
    state.entries.push({
      id: crypto.randomUUID(),
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
  const tbody = document.querySelector('#entryTable tbody');
  const rows = entriesOfMonth(currentYm).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">当月のデータがありません</td></tr>';
  } else {
    tbody.innerHTML = rows.map((e) => `
      <tr>
        <td>${e.date ? e.date : '(月単位)'}</td>
        <td>${escapeHtml(nameOfClient(e.clientId))}</td>
        <td>${escapeHtml(nameOfService(e.serviceId))}</td>
        <td class="num">${fmtYen(e.amount)}</td>
        <td>${escapeHtml(e.note || '')}</td>
        <td><button class="btn-icon" data-del="${e.id}">削除</button></td>
      </tr>`).join('');
  }
  const total = rows.reduce((a, e) => a + Number(e.amount || 0), 0);
  document.getElementById('entryTotal').textContent = fmtYen(total);

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
document.getElementById('clientForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('clientName').value.trim();
  const care = document.getElementById('clientCare').value;
  const note = document.getElementById('clientNote').value.trim();
  if (!name) return;
  state.clients.push({ id: crypto.randomUUID(), name, care, note });
  saveState();
  e.target.reset();
  toast('利用者を追加しました');
  renderClients();
});

function renderClients() {
  const tbody = document.querySelector('#clientTable tbody');
  if (state.clients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">利用者が登録されていません</td></tr>';
    return;
  }
  tbody.innerHTML = state.clients.map((c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.care || '')}</td>
      <td>${escapeHtml(c.note || '')}</td>
      <td><button class="btn-icon" data-del-client="${c.id}">削除</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-del-client]').forEach((b) => {
    b.addEventListener('click', () => {
      const used = state.entries.some((e) => e.clientId === b.dataset.delClient);
      if (used && !confirm('この利用者の売上記録も削除されます。続行しますか？')) return;
      if (!used && !confirm('この利用者を削除しますか？')) return;
      state.entries = state.entries.filter((e) => e.clientId !== b.dataset.delClient);
      state.clients = state.clients.filter((c) => c.id !== b.dataset.delClient);
      saveState();
      renderClients();
    });
  });
}

// ===== サービス分類 =====
document.getElementById('serviceForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('serviceName').value.trim();
  if (!name) return;
  if (state.services.some((s) => s.name === name)) { toast('同じ名前の分類が既にあります'); return; }
  state.services.push({ id: crypto.randomUUID(), name });
  saveState();
  e.target.reset();
  toast('分類を追加しました');
  renderServices();
});

function renderServices() {
  const tbody = document.querySelector('#serviceTable tbody');
  tbody.innerHTML = state.services.map((s) => {
    const count = state.entries.filter((e) => e.serviceId === s.id).length;
    return `<tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${count} 件</td>
      <td><button class="btn-icon" data-del-service="${s.id}">削除</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-del-service]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.delService;
      const count = state.entries.filter((e) => e.serviceId === id).length;
      const msg = count > 0
        ? `この分類を使った売上記録が ${count} 件あります。分類を削除すると「(削除済み)」と表示されますが、データは残ります。削除しますか？`
        : 'この分類を削除しますか？';
      if (!confirm(msg)) return;
      state.services = state.services.filter((s) => s.id !== id);
      saveState();
      renderServices();
    });
  });
}

// ===== Excel出力 =====
document.getElementById('exportBtn').addEventListener('click', () => {
  const rows = entriesOfMonth(currentYm);
  if (rows.length === 0) { toast('当月のデータがありません'); return; }
  const wb = XLSX.utils.book_new();

  // 明細
  const detail = rows.map((e) => ({
    日付: e.date || '(月単位)',
    利用者: nameOfClient(e.clientId),
    サービス分類: nameOfService(e.serviceId),
    金額: Number(e.amount || 0),
    備考: e.note || '',
  }));
  const ws1 = XLSX.utils.json_to_sheet(detail);
  XLSX.utils.book_append_sheet(wb, ws1, '明細');

  // 利用者別集計
  const byClient = new Map();
  rows.forEach((e) => byClient.set(e.clientId, (byClient.get(e.clientId) || 0) + Number(e.amount || 0)));
  const summary1 = [...byClient.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cid, amt]) => ({ 利用者: nameOfClient(cid), 金額: amt }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary1), '利用者別');

  // サービス別集計
  const byService = new Map();
  rows.forEach((e) => byService.set(e.serviceId, (byService.get(e.serviceId) || 0) + Number(e.amount || 0)));
  const summary2 = [...byService.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sid, amt]) => ({ サービス分類: nameOfService(sid), 金額: amt }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary2), 'サービス別');

  XLSX.writeFile(wb, `売上_${currentYm}.xlsx`);
  toast('Excelを書き出しました');
});

// ===== 初期化 =====
setMonth(currentYm);
switchView('dashboard');
