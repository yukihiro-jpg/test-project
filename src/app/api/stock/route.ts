import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export async function POST(req: NextRequest) {
  try {
    const { code, date, shares } = await req.json();
    if (!code || !date) {
      return NextResponse.json({ error: '証券コードと日付を入力してください' }, { status: 400 });
    }

    const ticker = code.includes('.') ? code : `${code}.T`;
    const inheritDate = new Date(date);
    const y = inheritDate.getFullYear();
    const m = inheritDate.getMonth(); // 0-indexed

    // 銘柄名取得
    let companyName = ticker;
    try {
      const quote: any = await yahooFinance.quote(ticker);
      companyName = quote?.longName || quote?.shortName || ticker;
    } catch { /* fallback */ }

    // ① 課税時期の終値
    const closeResult = await getCloseOnDate(ticker, inheritDate);

    // ② 課税時期の月の月平均
    const month2 = await getMonthlyAverage(ticker, y, m);

    // ③ 前月の月平均
    const pm = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    const month3 = await getMonthlyAverage(ticker, pm.y, pm.m);

    // ④ 前々月の月平均
    const pm2m = pm.m === 0 ? { y: pm.y - 1, m: 11 } : { y: pm.y, m: pm.m - 1 };
    const month4 = await getMonthlyAverage(ticker, pm2m.y, pm2m.m);

    const candidates: Record<string, number> = {
      '①課税時期の終値': closeResult.price,
      '②課税時期の月の月平均': month2.average,
      '③前月の月平均': month3.average,
      '④前々月の月平均': month4.average,
    };

    // 0でないもののうち最小を採用
    const validCandidates = Object.entries(candidates).filter(([, v]) => v > 0);
    const [adoptedLabel, adoptedPrice] = validCandidates.length > 0
      ? validCandidates.reduce((min, cur) => cur[1] < min[1] ? cur : min)
      : ['—', 0];

    const taxValue = adoptedPrice * (shares || 1);

    // 配当判定
    const dividendResult = await analyzeDividends(ticker, inheritDate, shares || 1);

    const monthNames = [
      `${y}年${m + 1}月`,
      `${pm.y}年${pm.m + 1}月`,
      `${pm2m.y}年${pm2m.m + 1}月`,
    ];

    return NextResponse.json({
      ok: true,
      result: {
        ticker,
        company_name: companyName,
        inherit_date: date,
        shares: shares || 1,
        close_on_date: closeResult.price,
        actual_date: closeResult.actualDate,
        avg2: month2.average, days2: month2.days,
        avg3: month3.average, days3: month3.days,
        avg4: month4.average, days4: month4.days,
        month2: monthNames[0], month3: monthNames[1], month4: monthNames[2],
        candidates,
        adopted_label: adoptedLabel,
        adopted_price: adoptedPrice,
        tax_value: taxValue,
        div_rights: dividendResult,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '計算エラー' }, { status: 500 });
  }
}

async function getCloseOnDate(ticker: string, target: Date): Promise<{ price: number; actualDate: string }> {
  const start = new Date(target);
  start.setDate(start.getDate() - 7);
  const end = new Date(target);
  end.setDate(end.getDate() + 1);

  try {
    const result: any = await yahooFinance.chart(ticker, {
      period1: start,
      period2: end,
      interval: '1d' as any,
    });
    const quotes: any[] = result?.quotes || [];
    const valid = quotes.filter(q => new Date(q.date) <= target && q.close != null);
    if (valid.length === 0) return { price: 0, actualDate: '' };
    const last = valid[valid.length - 1];
    return {
      price: Math.round(last.close),
      actualDate: new Date(last.date).toISOString().split('T')[0],
    };
  } catch {
    return { price: 0, actualDate: '' };
  }
}

async function getMonthlyAverage(ticker: string, year: number, month: number): Promise<{ average: number; days: number }> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  try {
    const result: any = await yahooFinance.chart(ticker, {
      period1: start,
      period2: end,
      interval: '1d' as any,
    });
    const quotes: any[] = result?.quotes || [];
    const closes = quotes.filter(q => q.close != null).map(q => q.close as number);
    if (closes.length === 0) return { average: 0, days: 0 };
    const sum = closes.reduce((a, b) => a + b, 0);
    return {
      average: Math.floor(sum / closes.length),
      days: closes.length,
    };
  } catch {
    return { average: 0, days: 0 };
  }
}

async function analyzeDividends(ticker: string, inheritDate: Date, shares: number) {
  const TAX_RATE = 0.20315;
  try {
    const result: any = await yahooFinance.chart(ticker, {
      period1: new Date(inheritDate.getFullYear() - 2, inheritDate.getMonth(), 1),
      period2: new Date(inheritDate.getFullYear() + 1, inheritDate.getMonth(), 1),
      interval: '1d' as any,
      events: 'div',
    });

    const events = result?.events?.dividends;
    if (!events || Object.keys(events).length === 0) {
      return { status: 'none', items: [], total_gross: 0, total_tax: 0, total_net: 0, error: null };
    }

    const items: any[] = [];
    for (const [dateStr, div] of Object.entries(events)) {
      const exDate = new Date(dateStr);
      const amount = (div as any).amount || 0;
      const paymentDate = new Date(exDate);
      paymentDate.setDate(paymentDate.getDate() + 80);

      const kenriTsuki = new Date(exDate);
      kenriTsuki.setDate(kenriTsuki.getDate() - 1);

      const isKitai = kenriTsuki < inheritDate && inheritDate < paymentDate;
      const isMishuu = paymentDate <= inheritDate && (inheritDate.getTime() - paymentDate.getTime()) / 86400000 <= 30;

      if (isKitai || isMishuu) {
        const gross = Math.round(amount * shares * 100) / 100;
        const tax = Math.round(gross * TAX_RATE * 100) / 100;
        const net = Math.round((gross - tax) * 100) / 100;
        items.push({
          status: isKitai ? '配当期待権' : '未収配当金',
          ex_date: exDate.toISOString().split('T')[0],
          div_per_share: amount,
          gross, tax, net,
          payment_estimated: true,
        });
      }
    }

    const totalGross = items.reduce((s: number, i: any) => s + i.gross, 0);
    const totalTax = items.reduce((s: number, i: any) => s + i.tax, 0);
    const totalNet = items.reduce((s: number, i: any) => s + i.net, 0);

    const status = items.some((i: any) => i.status === '配当期待権') ? 'kitai_ken'
      : items.some((i: any) => i.status === '未収配当金') ? 'mishuu' : 'none';

    return { status, items, total_gross: totalGross, total_tax: totalTax, total_net: totalNet, error: null };
  } catch (e: any) {
    return { status: 'none', items: [], total_gross: 0, total_tax: 0, total_net: 0, error: e.message };
  }
}
