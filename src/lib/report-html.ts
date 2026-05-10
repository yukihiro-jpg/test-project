import type { ReportData, FiscalYearData, MonthlyData } from '@/types/report'

function fmt(n: number): string {
  if (n === 0) return '0'
  return n.toLocaleString('ja-JP')
}

function fmtSign(n: number): string {
  return n >= 0 ? fmt(n) : `△${fmt(Math.abs(n))}`
}

// 期首から報告月までの累計を計算
function cumulativeUpTo(fy: FiscalYearData, reportMonth: number, key: keyof MonthlyData): number {
  let sum = 0
  for (const m of fy.months) {
    const val = m[key] as number
    sum += val
    if (m.month === reportMonth) break
  }
  return sum
}

// 報告月の単月データを取得
function getMonthData(fy: FiscalYearData, reportMonth: number): MonthlyData | undefined {
  return fy.months.find(m => m.month === reportMonth)
}

// 月ラベル
function monthLabel(m: number): string {
  return `${m}月`
}

// 期のラベルを短縮形で
function shortLabel(label: string): string {
  return label
}

function makeChartColors(count: number): string[] {
  const palette = ['#4472C4', '#ED7D31', '#A9D18E', '#FF0000', '#7030A0', '#00B0F0']
  return Array.from({ length: count }, (_, i) => palette[i % palette.length])
}

// 月次推移グラフ用データ（棒グラフ＋折れ線）
function buildMonthlyChartData(fy: FiscalYearData) {
  const months = fy.months.map(m => `${m.month}月`)
  return {
    labels: months,
    netSales: fy.months.map(m => m.netSales),
    grossProfit: fy.months.map(m => m.grossProfit),
    operatingProfit: fy.months.map(m => m.operatingProfit),
    ordinaryProfit: fy.months.map(m => m.ordinaryProfit),
  }
}

export function generateReportHtml(data: ReportData): string {
  const { client, reportMonth, reportYear, fiscalYears, generatedAt } = data
  const currentFY = fiscalYears[fiscalYears.length - 1]
  const prevFYs = fiscalYears.slice(0, -1)

  const currentMonthData = getMonthData(currentFY, reportMonth)

  // 累計計算
  const cumNetSales = cumulativeUpTo(currentFY, reportMonth, 'netSales')
  const cumGrossProfit = cumulativeUpTo(currentFY, reportMonth, 'grossProfit')
  const cumSga = cumulativeUpTo(currentFY, reportMonth, 'sgaExpense')
  const cumOpProfit = cumulativeUpTo(currentFY, reportMonth, 'operatingProfit')
  const cumOrdProfit = cumulativeUpTo(currentFY, reportMonth, 'ordinaryProfit')

  // 売上総利益率
  const grossProfitRate = currentMonthData && currentMonthData.netSales !== 0
    ? (currentMonthData.grossProfit / currentMonthData.netSales * 100).toFixed(1)
    : '0.0'
  const cumGrossProfitRate = cumNetSales !== 0
    ? (cumGrossProfit / cumNetSales * 100).toFixed(1)
    : '0.0'

  // FCF計算（営業CF近似: 経常利益 + 減価償却費 - 運転資本増加）
  const lastMonthData = currentMonthData
  const fcfMonthly = lastMonthData
    ? lastMonthData.ordinaryProfit + lastMonthData.depreciation
    : 0
  const cumDepreciation = cumulativeUpTo(currentFY, reportMonth, 'depreciation')
  const fcfCumulative = cumOrdProfit + cumDepreciation

  // 借入金（長期借入 + リース）
  const totalDebt = lastMonthData
    ? lastMonthData.longTermDebt + lastMonthData.leaseLiabilities
    : 0

  // 当座比率（流動資産/流動負債）
  const currentRatio = lastMonthData && lastMonthData.currentLiabilities !== 0
    ? (lastMonthData.currentAssets / lastMonthData.currentLiabilities * 100).toFixed(1)
    : '0.0'

  // チャートデータ構築
  const chartMonths = currentFY.months.map(m => `${m.month}月`)
  const netSalesData = currentFY.months.map(m => m.netSales)
  const grossProfitData = currentFY.months.map(m => m.grossProfit)
  const opProfitData = currentFY.months.map(m => m.operatingProfit)
  const ordProfitData = currentFY.months.map(m => m.ordinaryProfit)

  // 3期比較データ（単月）
  const compMonthlyNetSales = fiscalYears.map(fy => getMonthData(fy, reportMonth)?.netSales ?? 0)
  const compMonthlyGrossProfit = fiscalYears.map(fy => getMonthData(fy, reportMonth)?.grossProfit ?? 0)
  const compMonthlyOpProfit = fiscalYears.map(fy => getMonthData(fy, reportMonth)?.operatingProfit ?? 0)
  const compMonthlyOrdProfit = fiscalYears.map(fy => getMonthData(fy, reportMonth)?.ordinaryProfit ?? 0)

  // 3期比較データ（累計）
  const compCumNetSales = fiscalYears.map(fy => cumulativeUpTo(fy, reportMonth, 'netSales'))
  const compCumGrossProfit = fiscalYears.map(fy => cumulativeUpTo(fy, reportMonth, 'grossProfit'))
  const compCumOpProfit = fiscalYears.map(fy => cumulativeUpTo(fy, reportMonth, 'operatingProfit'))
  const compCumOrdProfit = fiscalYears.map(fy => cumulativeUpTo(fy, reportMonth, 'ordinaryProfit'))

  const fyLabels = fiscalYears.map(fy => fy.label)
  const colors = makeChartColors(fiscalYears.length)

  const reportTitle = `${client.name}　${reportYear}年${reportMonth}月度　月次報告書`
  const genDate = new Date(generatedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${reportTitle}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Meiryo', 'Yu Gothic', 'MS Gothic', sans-serif; font-size: 11px; color: #333; background: #f5f5f5; }
.page { width: 210mm; min-height: 297mm; margin: 10px auto; background: white; padding: 15mm; page-break-after: always; }
@media print { body { background: white; } .page { margin: 0; padding: 10mm; } }
h1 { font-size: 18px; font-weight: bold; color: #1a3a6b; border-bottom: 3px solid #1a3a6b; padding-bottom: 8px; margin-bottom: 20px; }
h2 { font-size: 14px; font-weight: bold; color: #1a3a6b; border-left: 4px solid #4472C4; padding-left: 8px; margin: 20px 0 10px; }
h3 { font-size: 12px; font-weight: bold; color: #444; margin: 15px 0 8px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
th { background: #1a3a6b; color: white; padding: 5px 8px; text-align: center; border: 1px solid #ccc; }
th.sub { background: #4472C4; }
td { padding: 4px 8px; border: 1px solid #ddd; text-align: right; }
td.label { text-align: left; background: #f9f9f9; font-weight: bold; }
td.sub-label { text-align: left; padding-left: 20px; }
tr.total td { background: #e8eef7; font-weight: bold; }
tr.highlight td { background: #fff3cd; font-weight: bold; }
tr.profit td { background: #d4edda; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.chart-container { position: relative; height: 200px; margin: 10px 0; }
.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
.kpi-card { border: 2px solid #4472C4; border-radius: 8px; padding: 12px; text-align: center; }
.kpi-card .label { font-size: 10px; color: #666; margin-bottom: 4px; }
.kpi-card .value { font-size: 18px; font-weight: bold; color: #1a3a6b; }
.kpi-card .unit { font-size: 10px; color: #666; }
.cover { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200mm; }
.cover h1 { border: none; font-size: 24px; text-align: center; margin-bottom: 30px; }
.cover .meta { color: #666; font-size: 13px; margin-top: 10px; }
.note { font-size: 9px; color: #888; margin-top: 5px; }
.positive { color: #1a7340; }
.negative { color: #c00; }
.section-title { background: #1a3a6b; color: white; padding: 6px 10px; font-size: 12px; font-weight: bold; margin: 15px 0 10px; }
</style>
</head>
<body>

<!-- Page 1: Cover -->
<div class="page">
  <div class="cover">
    <h1>${reportTitle}</h1>
    <div class="meta">決算月: ${client.fiscalYearEndMonth}月　／　対象期: ${currentFY.label}</div>
    <div class="meta">作成日: ${genDate}</div>
  </div>

  <div class="section-title">■ KPI サマリー（${reportMonth}月単月）</div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">純売上高</div>
      <div class="value">${fmt(currentMonthData?.netSales ?? 0)}</div>
      <div class="unit">千円</div>
    </div>
    <div class="kpi-card">
      <div class="label">売上総利益</div>
      <div class="value">${fmt(currentMonthData?.grossProfit ?? 0)}</div>
      <div class="unit">千円　(${grossProfitRate}%)</div>
    </div>
    <div class="kpi-card">
      <div class="label">営業利益</div>
      <div class="value ${(currentMonthData?.operatingProfit ?? 0) >= 0 ? 'positive' : 'negative'}">${fmtSign(currentMonthData?.operatingProfit ?? 0)}</div>
      <div class="unit">千円</div>
    </div>
    <div class="kpi-card">
      <div class="label">経常利益</div>
      <div class="value ${(currentMonthData?.ordinaryProfit ?? 0) >= 0 ? 'positive' : 'negative'}">${fmtSign(currentMonthData?.ordinaryProfit ?? 0)}</div>
      <div class="unit">千円</div>
    </div>
    <div class="kpi-card">
      <div class="label">当座比率</div>
      <div class="value">${currentRatio}</div>
      <div class="unit">%</div>
    </div>
    <div class="kpi-card">
      <div class="label">借入金残高</div>
      <div class="value">${fmt(totalDebt)}</div>
      <div class="unit">千円</div>
    </div>
  </div>

  <div class="section-title">■ 当期累計（期首〜${reportMonth}月）</div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">累計純売上高</div>
      <div class="value">${fmt(cumNetSales)}</div>
      <div class="unit">千円</div>
    </div>
    <div class="kpi-card">
      <div class="label">累計売上総利益</div>
      <div class="value">${fmt(cumGrossProfit)}</div>
      <div class="unit">千円　(${cumGrossProfitRate}%)</div>
    </div>
    <div class="kpi-card">
      <div class="label">累計経常利益</div>
      <div class="value ${cumOrdProfit >= 0 ? 'positive' : 'negative'}">${fmtSign(cumOrdProfit)}</div>
      <div class="unit">千円</div>
    </div>
  </div>
</div>

<!-- Page 2: 単月損益計算書 -->
<div class="page">
  <h1>損益計算書（${reportMonth}月単月）</h1>
  <h2>${currentFY.label} ${reportMonth}月度</h2>

  <table>
    <thead>
      <tr>
        <th style="width:40%">項目</th>
        <th>金額（千円）</th>
        <th>構成比</th>
      </tr>
    </thead>
    <tbody>
      ${buildPLRows(currentMonthData)}
    </tbody>
  </table>

  <h2>月次推移（${currentFY.label}）</h2>
  <div class="chart-container">
    <canvas id="monthlyChart"></canvas>
  </div>
  <p class="note">※ 棒グラフ: 純売上高・売上総利益　折れ線: 営業利益・経常利益（千円）</p>

  <script>
  new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(chartMonths)},
      datasets: [
        { label: '純売上高', type: 'bar', data: ${JSON.stringify(netSalesData)}, backgroundColor: 'rgba(68,114,196,0.6)', yAxisID: 'y' },
        { label: '売上総利益', type: 'bar', data: ${JSON.stringify(grossProfitData)}, backgroundColor: 'rgba(237,125,49,0.6)', yAxisID: 'y' },
        { label: '営業利益', type: 'line', data: ${JSON.stringify(opProfitData)}, borderColor: '#A9D18E', backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y' },
        { label: '経常利益', type: 'line', data: ${JSON.stringify(ordProfitData)}, borderColor: '#FF0000', backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } }
    }
  });
  </script>
</div>

<!-- Page 3: 3期比較（単月） -->
<div class="page">
  <h1>3期比較（${reportMonth}月単月）</h1>

  <table>
    <thead>
      <tr>
        <th style="width:30%">項目</th>
        ${fyLabels.map(l => `<th>${l}</th>`).join('')}
        ${fiscalYears.length >= 2 ? `<th>前期比</th>` : ''}
      </tr>
    </thead>
    <tbody>
      ${build3YearRows(fiscalYears, reportMonth, false)}
    </tbody>
  </table>

  <div class="two-col">
    <div>
      <h3>純売上高 比較</h3>
      <div class="chart-container" style="height:160px">
        <canvas id="cmpNetSalesChart"></canvas>
      </div>
    </div>
    <div>
      <h3>利益 比較</h3>
      <div class="chart-container" style="height:160px">
        <canvas id="cmpProfitChart"></canvas>
      </div>
    </div>
  </div>

  <script>
  new Chart(document.getElementById('cmpNetSalesChart'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(fyLabels)},
      datasets: [{ label: '純売上高', data: ${JSON.stringify(compMonthlyNetSales)}, backgroundColor: ${JSON.stringify(colors)} }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } } }
  });
  new Chart(document.getElementById('cmpProfitChart'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(fyLabels)},
      datasets: [
        { label: '売上総利益', data: ${JSON.stringify(compMonthlyGrossProfit)}, backgroundColor: 'rgba(68,114,196,0.7)' },
        { label: '営業利益', data: ${JSON.stringify(compMonthlyOpProfit)}, backgroundColor: 'rgba(237,125,49,0.7)' },
        { label: '経常利益', data: ${JSON.stringify(compMonthlyOrdProfit)}, backgroundColor: 'rgba(169,209,142,0.7)' },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 9 } } } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } } }
  });
  </script>
</div>

<!-- Page 4: 3期比較（累計） -->
<div class="page">
  <h1>3期比較（期首〜${reportMonth}月　累計）</h1>

  <table>
    <thead>
      <tr>
        <th style="width:30%">項目</th>
        ${fyLabels.map(l => `<th>${l}</th>`).join('')}
        ${fiscalYears.length >= 2 ? `<th>前期比</th>` : ''}
      </tr>
    </thead>
    <tbody>
      ${build3YearRows(fiscalYears, reportMonth, true)}
    </tbody>
  </table>

  <div class="two-col">
    <div>
      <h3>累計売上高 比較</h3>
      <div class="chart-container" style="height:160px">
        <canvas id="cumNetSalesChart"></canvas>
      </div>
    </div>
    <div>
      <h3>累計利益 比較</h3>
      <div class="chart-container" style="height:160px">
        <canvas id="cumProfitChart"></canvas>
      </div>
    </div>
  </div>

  <script>
  new Chart(document.getElementById('cumNetSalesChart'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(fyLabels)},
      datasets: [{ label: '累計純売上高', data: ${JSON.stringify(compCumNetSales)}, backgroundColor: ${JSON.stringify(colors)} }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } } }
  });
  new Chart(document.getElementById('cumProfitChart'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(fyLabels)},
      datasets: [
        { label: '累計売上総利益', data: ${JSON.stringify(compCumGrossProfit)}, backgroundColor: 'rgba(68,114,196,0.7)' },
        { label: '累計営業利益', data: ${JSON.stringify(compCumOpProfit)}, backgroundColor: 'rgba(237,125,49,0.7)' },
        { label: '累計経常利益', data: ${JSON.stringify(compCumOrdProfit)}, backgroundColor: 'rgba(169,209,142,0.7)' },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 9 } } } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } } }
  });
  </script>
</div>

<!-- Page 5: FCF・運転資本 -->
<div class="page">
  <h1>キャッシュフロー・財務安全性</h1>

  <h2>フリーキャッシュフロー（FCF）</h2>
  <table>
    <thead>
      <tr><th style="width:40%">項目</th><th>${reportMonth}月単月</th><th>期首〜${reportMonth}月 累計</th></tr>
    </thead>
    <tbody>
      <tr><td class="label">経常利益</td><td>${fmtSign(currentMonthData?.ordinaryProfit ?? 0)}</td><td>${fmtSign(cumOrdProfit)}</td></tr>
      <tr><td class="label">（＋）減価償却費</td><td>${fmt(currentMonthData?.depreciation ?? 0)}</td><td>${fmt(cumDepreciation)}</td></tr>
      <tr class="total"><td class="label">≒ FCF（簡易）</td><td>${fmtSign(fcfMonthly)}</td><td>${fmtSign(fcfCumulative)}</td></tr>
    </tbody>
  </table>

  <h2>財務安全性指標</h2>
  <table>
    <thead>
      <tr><th style="width:40%">指標</th><th>金額 / 比率</th><th>説明</th></tr>
    </thead>
    <tbody>
      <tr><td class="label">流動資産</td><td>${fmt(currentMonthData?.currentAssets ?? 0)} 千円</td><td></td></tr>
      <tr><td class="label">流動負債</td><td>${fmt(currentMonthData?.currentLiabilities ?? 0)} 千円</td><td></td></tr>
      <tr class="total"><td class="label">当座比率（流動資産/流動負債）</td><td>${currentRatio}%</td><td>100%以上が目安</td></tr>
      <tr><td class="label">長期借入金</td><td>${fmt(currentMonthData?.longTermDebt ?? 0)} 千円</td><td></td></tr>
      <tr><td class="label">リース債務</td><td>${fmt(currentMonthData?.leaseLiabilities ?? 0)} 千円</td><td></td></tr>
      <tr class="highlight"><td class="label">借入金合計</td><td>${fmt(totalDebt)} 千円</td><td></td></tr>
    </tbody>
  </table>

  <h2>月次 経常利益・減価償却費・FCF 推移</h2>
  <div class="chart-container">
    <canvas id="fcfChart"></canvas>
  </div>

  <script>
  new Chart(document.getElementById('fcfChart'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(chartMonths)},
      datasets: [
        { label: '経常利益', type: 'bar', data: ${JSON.stringify(currentFY.months.map(m => m.ordinaryProfit))}, backgroundColor: 'rgba(68,114,196,0.6)', yAxisID: 'y' },
        { label: '減価償却費', type: 'bar', data: ${JSON.stringify(currentFY.months.map(m => m.depreciation))}, backgroundColor: 'rgba(237,125,49,0.6)', yAxisID: 'y' },
        { label: 'FCF（簡易）', type: 'line', data: ${JSON.stringify(currentFY.months.map(m => m.ordinaryProfit + m.depreciation))}, borderColor: '#FF0000', backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } }
    }
  });
  </script>
</div>

<!-- Page 6: 借入金返済 -->
<div class="page">
  <h1>借入金・返済能力分析</h1>

  <h2>借入金残高推移</h2>
  <div class="chart-container">
    <canvas id="debtChart"></canvas>
  </div>

  <script>
  new Chart(document.getElementById('debtChart'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(chartMonths)},
      datasets: [
        { label: '長期借入金', data: ${JSON.stringify(currentFY.months.map(m => m.longTermDebt))}, backgroundColor: 'rgba(68,114,196,0.7)' },
        { label: 'リース債務', data: ${JSON.stringify(currentFY.months.map(m => m.leaseLiabilities))}, backgroundColor: 'rgba(237,125,49,0.7)' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } }
      }
    }
  });
  </script>

  <h2>返済能力（借入金 / FCF）</h2>
  <table>
    <thead>
      <tr><th style="width:40%">項目</th><th>金額（千円）</th></tr>
    </thead>
    <tbody>
      <tr><td class="label">借入金合計（月末残高）</td><td>${fmt(totalDebt)}</td></tr>
      <tr><td class="label">年換算 FCF（簡易）</td><td>${fmt(fcfCumulative)}</td></tr>
      <tr class="total"><td class="label">債務償還年数（借入金 / 年換算FCF）</td>
        <td>${fcfCumulative > 0 ? (totalDebt / fcfCumulative).toFixed(1) + ' 年' : 'N/A'}</td>
      </tr>
    </tbody>
  </table>

  <h2>流動資産・流動負債 推移</h2>
  <div class="chart-container">
    <canvas id="liquidityChart"></canvas>
  </div>

  <script>
  new Chart(document.getElementById('liquidityChart'), {
    type: 'line',
    data: {
      labels: ${JSON.stringify(chartMonths)},
      datasets: [
        { label: '流動資産', data: ${JSON.stringify(currentFY.months.map(m => m.currentAssets))}, borderColor: '#4472C4', backgroundColor: 'rgba(68,114,196,0.1)', fill: true, tension: 0.3 },
        { label: '流動負債', data: ${JSON.stringify(currentFY.months.map(m => m.currentLiabilities))}, borderColor: '#ED7D31', backgroundColor: 'rgba(237,125,49,0.1)', fill: true, tension: 0.3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } }
    }
  });
  </script>
</div>

<!-- Page 7: 段階利益比較 -->
<div class="page">
  <h1>段階利益 ${reportMonth}月推移（${currentFY.label}）</h1>

  <h2>月次推移</h2>
  <table>
    <thead>
      <tr>
        <th style="width:20%">項目</th>
        ${currentFY.months.map(m => `<th>${m.month}月</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${buildMonthlyTable(currentFY)}
    </tbody>
  </table>

  <h2>段階利益グラフ</h2>
  <div class="chart-container" style="height:220px">
    <canvas id="stageProfitChart"></canvas>
  </div>

  <script>
  new Chart(document.getElementById('stageProfitChart'), {
    type: 'line',
    data: {
      labels: ${JSON.stringify(chartMonths)},
      datasets: [
        { label: '売上総利益', data: ${JSON.stringify(currentFY.months.map(m => m.grossProfit))}, borderColor: '#4472C4', tension: 0.3, fill: false },
        { label: '営業利益', data: ${JSON.stringify(currentFY.months.map(m => m.operatingProfit))}, borderColor: '#ED7D31', tension: 0.3, fill: false },
        { label: '経常利益', data: ${JSON.stringify(currentFY.months.map(m => m.ordinaryProfit))}, borderColor: '#A9D18E', tension: 0.3, fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
      scales: { y: { ticks: { font: { size: 9 }, callback: v => v.toLocaleString('ja-JP') } } }
    }
  });
  </script>
</div>

<!-- Page 8: まとめ -->
<div class="page">
  <h1>月次報告 まとめ</h1>

  <h2>主要指標サマリー</h2>
  <table>
    <thead>
      <tr>
        <th style="width:30%">指標</th>
        <th>${reportMonth}月単月</th>
        <th>期首〜${reportMonth}月累計</th>
        <th>年計</th>
      </tr>
    </thead>
    <tbody>
      <tr><td class="label">純売上高</td><td>${fmt(currentMonthData?.netSales ?? 0)}</td><td>${fmt(cumNetSales)}</td><td>${fmt(currentFY.annual.netSales)}</td></tr>
      <tr><td class="label">売上原価</td><td>${fmt(currentMonthData?.cogs ?? 0)}</td><td>${fmt(cumulativeUpTo(currentFY, reportMonth, 'cogs'))}</td><td>${fmt(currentFY.annual.cogs)}</td></tr>
      <tr class="total"><td class="label">売上総利益</td><td>${fmt(currentMonthData?.grossProfit ?? 0)}</td><td>${fmt(cumGrossProfit)}</td><td>${fmt(currentFY.annual.grossProfit)}</td></tr>
      <tr><td class="label">販管費</td><td>${fmt(currentMonthData?.sgaExpense ?? 0)}</td><td>${fmt(cumSga)}</td><td>${fmt(currentFY.annual.sgaExpense)}</td></tr>
      <tr class="profit"><td class="label">営業利益</td><td>${fmtSign(currentMonthData?.operatingProfit ?? 0)}</td><td>${fmtSign(cumOpProfit)}</td><td>${fmtSign(currentFY.annual.operatingProfit)}</td></tr>
      <tr class="highlight"><td class="label">経常利益</td><td>${fmtSign(currentMonthData?.ordinaryProfit ?? 0)}</td><td>${fmtSign(cumOrdProfit)}</td><td>${fmtSign(currentFY.annual.ordinaryProfit)}</td></tr>
    </tbody>
  </table>

  <h2>財務健全性</h2>
  <table>
    <tbody>
      <tr><td class="label">流動資産</td><td>${fmt(currentMonthData?.currentAssets ?? 0)} 千円</td></tr>
      <tr><td class="label">流動負債</td><td>${fmt(currentMonthData?.currentLiabilities ?? 0)} 千円</td></tr>
      <tr class="total"><td class="label">当座比率</td><td>${currentRatio}%</td></tr>
      <tr><td class="label">借入金合計（長期借入＋リース）</td><td>${fmt(totalDebt)} 千円</td></tr>
      <tr><td class="label">減価償却費（累計）</td><td>${fmt(cumDepreciation)} 千円</td></tr>
      <tr class="highlight"><td class="label">FCF（簡易・累計）</td><td>${fmtSign(fcfCumulative)} 千円</td></tr>
    </tbody>
  </table>

  <div style="margin-top: 30px; padding: 15px; border: 1px solid #ddd; background: #f9f9f9; border-radius: 4px;">
    <strong>報告書情報</strong><br>
    作成日時: ${genDate}<br>
    対象顧問先: ${client.name}<br>
    対象期: ${currentFY.label}（${currentFY.startMonth}月〜${currentFY.endMonth}月）<br>
    報告月: ${reportYear}年${reportMonth}月<br>
    <span class="note">※ 金額単位: 千円　※ △は負数を表します</span>
  </div>
</div>

</body>
</html>`
}

function buildPLRows(m: MonthlyData | undefined): string {
  if (!m) return '<tr><td colspan="3" style="text-align:center">データなし</td></tr>'
  const ns = m.netSales || 1
  const row = (label: string, val: number, cls = '') => {
    const rate = ns !== 0 ? (val / ns * 100).toFixed(1) : '0.0'
    return `<tr${cls ? ` class="${cls}"` : ''}><td class="label">${label}</td><td>${fmtSign(val)}</td><td>${rate}%</td></tr>`
  }
  return [
    row('純売上高', m.netSales),
    row('売上原価', m.cogs),
    `<tr class="total"><td class="label">売上総利益</td><td>${fmtSign(m.grossProfit)}</td><td>${(m.grossProfit / ns * 100).toFixed(1)}%</td></tr>`,
    row('販売費及び一般管理費', m.sgaExpense),
    `<tr class="profit"><td class="label">営業利益</td><td>${fmtSign(m.operatingProfit)}</td><td>${(m.operatingProfit / ns * 100).toFixed(1)}%</td></tr>`,
    row('営業外収益', m.ordinaryIncome),
    row('支払利息', m.interestExpense),
    `<tr class="highlight"><td class="label">経常利益</td><td>${fmtSign(m.ordinaryProfit)}</td><td>${(m.ordinaryProfit / ns * 100).toFixed(1)}%</td></tr>`,
  ].join('')
}

function build3YearRows(fiscalYears: FiscalYearData[], reportMonth: number, cumulative: boolean): string {
  const getValue = (fy: FiscalYearData, key: keyof MonthlyData) =>
    cumulative ? cumulativeUpTo(fy, reportMonth, key) : (getMonthData(fy, reportMonth)?.[key] ?? 0) as number

  const items: Array<{ label: string; key: keyof MonthlyData; cls?: string }> = [
    { label: '純売上高', key: 'netSales' },
    { label: '売上原価', key: 'cogs' },
    { label: '売上総利益', key: 'grossProfit', cls: 'total' },
    { label: '販管費', key: 'sgaExpense' },
    { label: '営業利益', key: 'operatingProfit', cls: 'profit' },
    { label: '経常利益', key: 'ordinaryProfit', cls: 'highlight' },
  ]

  return items.map(({ label, key, cls }) => {
    const vals = fiscalYears.map(fy => getValue(fy, key) as number)
    const prev = vals.length >= 2 ? vals[vals.length - 2] : null
    const curr = vals[vals.length - 1]
    const yoy = prev !== null && prev !== 0 ? ((curr - prev) / Math.abs(prev) * 100).toFixed(1) + '%' : '-'
    const tds = vals.map(v => `<td>${fmtSign(v)}</td>`).join('')
    const yoyTd = fiscalYears.length >= 2 ? `<td class="${curr >= (prev ?? 0) ? 'positive' : 'negative'}">${yoy}</td>` : ''
    return `<tr${cls ? ` class="${cls}"` : ''}><td class="label">${label}</td>${tds}${yoyTd}</tr>`
  }).join('')
}

function buildMonthlyTable(fy: FiscalYearData): string {
  const items: Array<{ label: string; key: keyof MonthlyData }> = [
    { label: '純売上高', key: 'netSales' },
    { label: '売上総利益', key: 'grossProfit' },
    { label: '営業利益', key: 'operatingProfit' },
    { label: '経常利益', key: 'ordinaryProfit' },
  ]
  return items.map(({ label, key }) => {
    const tds = fy.months.map(m => `<td>${fmtSign(m[key] as number)}</td>`).join('')
    return `<tr><td class="label">${label}</td>${tds}</tr>`
  }).join('')
}
