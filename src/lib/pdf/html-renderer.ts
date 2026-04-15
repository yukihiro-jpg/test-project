/**
 * レポートの HTML テンプレート
 *
 * Puppeteer でこの HTML を PDF に変換する。A4 縦・モノクロ印刷を想定。
 * 配色は黒・赤（悪化）・青（改善）の3色のみ。
 */

import type { Comment, ReportSection } from '../types'

export interface RenderOptions {
  clientName: string
  year: number
  month: number
  sections: ReportSection[]
  commentsBySection: Record<string, Comment[]>
  fontSize?: 'normal' | 'large' | 'extra_large'
}

export function renderReportHtml(opts: RenderOptions): string {
  const fontSize =
    opts.fontSize === 'extra_large' ? '14pt' : opts.fontSize === 'large' ? '12pt' : '10pt'

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escape(opts.clientName)} ${opts.year}年${opts.month}月 月次財務報告</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  body {
    font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'Noto Sans CJK JP', sans-serif;
    font-size: ${fontSize};
    color: #111827;
    line-height: 1.5;
    margin: 0;
  }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 1.4em; margin: 0 0 0.5em; border-bottom: 2px solid #111827; padding-bottom: 0.3em; }
  h2 { font-size: 1.15em; margin: 0.8em 0 0.4em; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9em; }
  th, td { border: 1px solid #9ca3af; padding: 3px 6px; text-align: right; }
  th { background-color: #f3f4f6; font-weight: bold; }
  td.label, th.label { text-align: left; }
  .improved { color: #1e40af; } /* blue-800 */
  .worsened { color: #b91c1c; } /* red-700 */
  .comment-area {
    margin-top: 1.2em;
    padding: 0.6em;
    border: 1px dashed #6b7280;
    font-size: 0.9em;
  }
  .comment-area .label { font-weight: bold; margin-bottom: 0.3em; font-size: 0.9em; }
  .page-footer {
    position: fixed; bottom: 5mm; right: 10mm; font-size: 0.8em; color: #6b7280;
  }
  .header-info {
    display: flex; justify-content: space-between;
    font-size: 0.85em; color: #6b7280; margin-bottom: 0.5em;
  }
</style>
</head>
<body>
${opts.sections.map((s) => renderSection(s, opts)).join('\n')}
</body>
</html>`
}

function renderSection(section: ReportSection, opts: RenderOptions): string {
  const comments = opts.commentsBySection[section.type] ?? []
  return `
<div class="page">
  <div class="header-info">
    <span>${escape(opts.clientName)}</span>
    <span>${opts.year}年${opts.month}月</span>
  </div>
  <h1>${section.pageNumber}. ${escape(section.title)}</h1>
  ${renderSectionContent(section)}
  ${renderComments(comments)}
</div>`
}

function renderSectionContent(section: ReportSection): string {
  switch (section.type) {
    case 'performance':
      return renderPerformance(section.content as PerformanceContent)
    case 'advisories':
      return renderAdvisories(section.content as AdvisoriesContent)
    case 'variance_analysis':
      return renderVariance(section.content as VarianceContent)
    default:
      return `<pre>${escape(JSON.stringify(section.content, null, 2))}</pre>`
  }
}

// -----------------------------------------------------------------------------
// セクション別レンダラ
// -----------------------------------------------------------------------------

interface PerformanceContent {
  pl: Array<{ code: string; name: string; amount: number; ratio?: number }>
  bs: Array<{ code: string; name: string; amount: number; ratio?: number }>
}

function renderPerformance(content: PerformanceContent): string {
  return `
<h2>損益計算書</h2>
<table>
  <thead><tr><th class="label">科目</th><th>当月金額</th><th>構成比</th></tr></thead>
  <tbody>
    ${content.pl.map((r) => `
      <tr>
        <td class="label">${escape(r.name)}</td>
        <td>${formatAmount(r.amount)}</td>
        <td>${r.ratio != null ? r.ratio.toFixed(1) + '%' : '-'}</td>
      </tr>`).join('')}
  </tbody>
</table>
<h2>貸借対照表</h2>
<table>
  <thead><tr><th class="label">科目</th><th>当月残高</th><th>構成比</th></tr></thead>
  <tbody>
    ${content.bs.map((r) => `
      <tr>
        <td class="label">${escape(r.name)}</td>
        <td>${formatAmount(r.amount)}</td>
        <td>${r.ratio != null ? r.ratio.toFixed(1) + '%' : '-'}</td>
      </tr>`).join('')}
  </tbody>
</table>`
}

interface AdvisoriesContent {
  items: Array<{
    accountCode: string
    accountName: string
    type: 'mom' | 'yoy'
    direction: 'increase' | 'decrease'
    changeRatio: number
    currentAmount: number
    comparisonAmount: number
  }>
}

function renderAdvisories(content: AdvisoriesContent): string {
  if (content.items.length === 0) {
    return '<p>当月は特筆すべき変動はありません。</p>'
  }
  return `
<table>
  <thead>
    <tr>
      <th class="label">科目</th>
      <th class="label">比較</th>
      <th>当月</th>
      <th>前月/前年</th>
      <th>変動率</th>
    </tr>
  </thead>
  <tbody>
    ${content.items.map((item) => {
      const cls = item.direction === 'increase' ? 'improved' : 'worsened'
      return `
      <tr>
        <td class="label">${escape(item.accountName)}</td>
        <td class="label">${item.type === 'mom' ? '前月比' : '前年同月比'}</td>
        <td>${formatAmount(item.currentAmount)}</td>
        <td>${formatAmount(item.comparisonAmount)}</td>
        <td class="${cls}">${(item.changeRatio * 100).toFixed(1)}%</td>
      </tr>`
    }).join('')}
  </tbody>
</table>`
}

interface VarianceContent {
  details: Array<{
    account: { code: string; name: string }
    type: 'mom' | 'yoy'
    current: number
    comparison: number
    ratio: number
    topContributors: Array<{ description: string; counter: string; amount: number; date: string }>
  }>
}

function renderVariance(content: VarianceContent): string {
  if (content.details.length === 0) return '<p>当月は深掘り対象の科目はありません。</p>'
  return content.details.map((d) => `
    <h2>${escape(d.account.name)}（${d.type === 'mom' ? '前月比' : '前年同月比'} ${(d.ratio * 100).toFixed(1)}%）</h2>
    <table>
      <thead>
        <tr>
          <th class="label">日付</th>
          <th class="label">摘要</th>
          <th class="label">相手科目</th>
          <th>金額</th>
        </tr>
      </thead>
      <tbody>
        ${d.topContributors.map((c) => `
          <tr>
            <td class="label">${escape(c.date.split('T')[0])}</td>
            <td class="label">${escape(c.description)}</td>
            <td class="label">${escape(c.counter)}</td>
            <td>${formatAmount(c.amount)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`).join('\n')
}

function renderComments(comments: Comment[]): string {
  if (comments.length === 0) {
    return `<div class="comment-area">
      <div class="label">コメント記入欄</div>
      <div style="min-height: 40mm;"></div>
    </div>`
  }
  return `<div class="comment-area">
    <div class="label">コメント</div>
    ${comments.map((c) => `
      <div>${c.tags.length ? `[${c.tags.join(', ')}] ` : ''}${escape(c.content)}</div>
    `).join('')}
  </div>`
}

// -----------------------------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------------------------

function formatAmount(n: number): string {
  if (n === 0 || !isFinite(n)) return '-'
  return Math.round(n).toLocaleString('ja-JP')
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
