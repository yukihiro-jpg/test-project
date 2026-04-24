import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

interface QuoteData { date: string; close: number; }

/** Yahoo Finance API (US)から株価データを取得 - yfinanceと同じデータソース */
async function fetchYahooChart(ticker: string, period1: Date, period2: Date): Promise<QuoteData[]> {
  const p1 = Math.floor(period1.getTime() / 1000);
  const p2 = Math.floor(period2.getTime() / 1000);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${p1}&period2=${p2}&interval=1d&events=div`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const closes: number[] = result.indicators?.quote?.[0]?.close || [];
    const data: QuoteData[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null || isNaN(close)) continue;
      const d = new Date(timestamps[i] * 1000);
      data.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        close: Math.round(close * 10) / 10,
      });
    }
    return data;
  } catch {
    return [];
  }
}

/** 銘柄名取得 - Yahoo Finance Japan */
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
    }
    return code;
  } catch {
    return code;
  }
}

/** 銘柄名取得 - Yahoo Finance US (フォールバック) */
async function fetchCompanyNameUS(ticker: string): Promise<string> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return ticker;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    return meta?.longName || meta?.shortName || ticker;
  } catch {
    return ticker;
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

    // 3ヶ月前から当月末までのデータを一括取得
    const rangeStart = new Date(y, m - 2, 1);
    const rangeEnd = new Date(y, m + 1, 1);

    // 銘柄名とチャートデータを並列取得
    const [nameJP, nameUS, allPrices] = await Promise.all([
      fetchCompanyName(ticker),
      fetchCompanyNameUS(ticker),
      fetchYahooChart(ticker, rangeStart, rangeEnd),
    ]);

    // 日本語名があればそちらを優先
    const companyName = (nameJP && nameJP !== ticker) ? nameJP : nameUS;

    if (allPrices.length === 0) {
      return NextResponse.json({
        error: `${ticker}の株価データが取得できませんでした。銘柄コードを確認してください。`
      }, { status: 500 });
    }

    // ① 課税時期の終値
    const beforeInherit = allPrices.filter(p => p.date <= date);
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
    const pm2 = pm.m === 0 ? { y: pm.y - 1, m: 11 } : { y: pm.y, m: pm.m - 1 };
    const month4Data = allPrices.filter(p => {
      const d = new Date(p.date);
      return d.getFullYear() === pm2.y && d.getMonth() === pm2.m;
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
        month4: `${pm2.y}年${pm2.m + 1}月`,
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
