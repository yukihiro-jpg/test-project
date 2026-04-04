import Decimal from 'decimal.js';

/**
 * 複利年金現価率を計算する
 * PV = (1 - (1 + r)^(-n)) / r
 *
 * @param years 残存年数 (n)
 * @param rate 予定利率 (r) 例: 0.015 = 1.5%
 * @returns 複利年金現価率
 */
export function compoundAnnuityPresentValueFactor(
  years: number,
  rate: Decimal,
): Decimal {
  if (years <= 0) return new Decimal(0);
  if (rate.isZero()) return new Decimal(years);

  const one = new Decimal(1);
  const onePlusR = one.plus(rate);
  const discountFactor = onePlusR.pow(-years);
  return one.minus(discountFactor).div(rate);
}
