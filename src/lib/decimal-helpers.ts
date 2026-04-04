import Decimal from 'decimal.js';

/** Decimal値の配列から最大値を返す。nullは無視する */
export function decimalMax(...values: (Decimal | null)[]): Decimal {
  const filtered = values.filter((v): v is Decimal => v !== null);
  if (filtered.length === 0) return new Decimal(0);
  return filtered.reduce((max, v) => (v.gt(max) ? v : max));
}

/** Decimal値の配列の合計を返す */
export function decimalSum(...values: (Decimal | null)[]): Decimal {
  return values
    .filter((v): v is Decimal => v !== null)
    .reduce((sum, v) => sum.plus(v), new Decimal(0));
}

/** 円未満切り捨て */
export function floorToYen(value: Decimal): Decimal {
  return value.floor();
}

/** number | null を Decimal | null に変換 */
export function toDecimalOrNull(value: number | null): Decimal | null {
  return value !== null ? new Decimal(value) : null;
}
