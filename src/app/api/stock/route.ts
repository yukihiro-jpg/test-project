import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

interface CloseData { date: string; close: number; }

/** Yahoo Finance Japanから日次終値を取得（スクレイピング） */
async function fetchHistoricalPrices(code: string, startDate: Date, endDate: Date): Promise<CloseData[]> {
  const codeOnly = code.replace('.T', '');
  const results: CloseData[] = [];

  // Yahoo Finance Japanの履歴ページ（月ごとに複数ページ）
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  // 全ページを取得（1ページ50件程度）
  for (let page = 1; page <= 5; page++) {
    const url = `https://finance.yahoo.co.jp/quote/${codeOnly}.T/history?from=${startYear}${String(startMonth).padStart(2, '0')}01&to=${endYear}${String(endMonth).padStart(2, '0')}31&timeFrame=d&page=${page}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) break;
      const html = await res.text();

      // 履歴テーブルを抽出（gsフラグの代わりにdotAllを使う）
      const rowRegex = new RegExp('<tr[^>]*>([\\s\\S]*?)<\\/tr>', 'g');
      const cellRegex = new RegExp('<td[^>]*>([\\s\\S]*?)<\\/td>', 'g');
      const matches = html.matchAll(rowRegex);
      let found = false;

      for (const rowMatch of matches) {
        const rowHtml = rowMatch[1];
        const cells = [...rowHtml.matchAll(cellRegex)].map(c => c[1].replace(/<[^>]+>/g, '').trim());
        if (cells.length < 5) continue;

        // 日付: "2024年12月30日" 形式
        const dateMatch = cells[0].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (!dateMatch) continue;

        const close = parseFloat(cells[4].replace(/,/g, ''));
        if (isNaN(close) || close <= 0) continue;

        const dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        const d = new Date(dateStr);
        if (d >= startDate && d <= endDate) {
          results.push({ date: dateStr, close });
          found = true;
        }
      }
      if (!found) break;
    } catch (e) {
      break;
    }
  }

  // 重複除去＆ソート
  const uniqueMap = new Map<string, CloseData>();
  results.forEach(r => uniqueMap.set(r.date, r));
  return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** 銘柄名取得 */
async function fetchCompanyName(code: string): Promise<string> {
  const codeOnly = code.replace('.T', '');
  try {
    const res = await fetch(`https://finance.yahoo.co.jp/quote/${codeOnly}.T`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return code;
    const html = await res.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const title = titleMatch[1];
      const m = title.match(/^(.+?)【\d+】/);
      if (m) return m[1].trim();
      if (title.includes('：')) return title.split('：')[0].trim();
      if (title.includes(' - ')) return title.split(' - ')[0].trim();
    }
    return code;
  } catch {
    return code;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, date, shares } = await req.json();
    if (!code || !date) {
      return NextResponse.json({ error: '証券コードと日付を入力してください' }, { status: 400 });
    }

    const ticker = code.includes('.') ? code : `${code}.T`;
    const inheritDate = new Date(date);
    const y = inheritDate.getFullYear();
    const m = inheritDate.getMonth();

    // 銘柄名と履歴データを並列取得
    const rangeStart = new Date(y, m - 3, 1);
    const rangeEnd = new Date(y, m + 1, 0);

    const [companyName, allPrices] = await Promise.all([
      fetchCompanyName(ticker),
      fetchHistoricalPrices(ticker, rangeStart, rangeEnd),
    ]);

    if (allPrices.length === 0) {
      return NextResponse.json({
        error: `${ticker}の株価データが取得できませんでした。銘柄コードを確認してください。`
      }, { status: 500 });
    }

    // ① 課税時期の終値（その日以前で最新の終値）
    const beforeInherit = allPrices.filter(p => new Date(p.date) <= inheritDate);
    const closeOnDate = beforeInherit.length > 0 ? beforeInherit[beforeInherit.length - 1] : { date: '', close: 0 };

    // ② 課税時期の月
    const month2Data = allPrices.filter(p => {
      const d = new Date(p.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    const avg2 = month2Data.length > 0 ? Math.floor(month2Data.reduce((s, p) => s + p.close, 0) / month2Data.length) : 0;

    // ③ 前月
    const pm = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    const month3Data = allPrices.filter(p => {
      const d = new Date(p.date);
      return d.getFullYear() === pm.y && d.getMonth() === pm.m;
    });
    const avg3 = month3Data.length > 0 ? Math.floor(month3Data.reduce((s, p) => s + p.close, 0) / month3Data.length) : 0;

    // ④ 前々月
    const pm2m = pm.m === 0 ? { y: pm.y - 1, m: 11 } : { y: pm.y, m: pm.m - 1 };
    const month4Data = allPrices.filter(p => {
      const d = new Date(p.date);
      return d.getFullYear() === pm2m.y && d.getMonth() === pm2m.m;
    });
    const avg4 = month4Data.length > 0 ? Math.floor(month4Data.reduce((s, p) => s + p.close, 0) / month4Data.length) : 0;

    const candidates: Record<string, number> = {
      '①課税時期の終値': Math.round(closeOnDate.close),
      '②課税時期の月の月平均': avg2,
      '③前月の月平均': avg3,
      '④前々月の月平均': avg4,
    };

    const validCandidates = Object.entries(candidates).filter(([, v]) => v > 0);
    const [adoptedLabel, adoptedPrice] = validCandidates.length > 0
      ? validCandidates.reduce((min, cur) => cur[1] < min[1] ? cur : min)
      : ['—', 0];

    const taxValue = adoptedPrice * (shares || 1);

    return NextResponse.json({
      ok: true,
      result: {
        ticker,
        company_name: companyName,
        inherit_date: date,
        shares: shares || 1,
        close_on_date: Math.round(closeOnDate.close),
        actual_date: closeOnDate.date,
        avg2, days2: month2Data.length,
        avg3, days3: month3Data.length,
        avg4, days4: month4Data.length,
        month2: `${y}年${m + 1}月`,
        month3: `${pm.y}年${pm.m + 1}月`,
        month4: `${pm2m.y}年${pm2m.m + 1}月`,
        candidates,
        adopted_label: adoptedLabel,
        adopted_price: adoptedPrice,
        tax_value: taxValue,
        div_rights: { status: 'none', items: [], total_gross: 0, total_tax: 0, total_net: 0, error: null },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '計算エラー' }, { status: 500 });
  }
}
