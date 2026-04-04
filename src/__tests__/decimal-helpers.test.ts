import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { decimalMax, decimalSum, floorToYen, toDecimalOrNull } from '@/lib/decimal-helpers';

describe('decimalMax', () => {
  it('複数のDecimalから最大値を返す', () => {
    const result = decimalMax(new Decimal(100), new Decimal(300), new Decimal(200));
    expect(result.eq(new Decimal(300))).toBe(true);
  });

  it('nullを含む場合はnull以外の最大値を返す', () => {
    const result = decimalMax(null, new Decimal(500), null, new Decimal(200));
    expect(result.eq(new Decimal(500))).toBe(true);
  });

  it('すべてnullの場合は0を返す', () => {
    const result = decimalMax(null, null);
    expect(result.eq(new Decimal(0))).toBe(true);
  });

  it('空の場合は0を返す', () => {
    const result = decimalMax();
    expect(result.eq(new Decimal(0))).toBe(true);
  });
});

describe('decimalSum', () => {
  it('合計を計算する', () => {
    const result = decimalSum(new Decimal(100), new Decimal(200), new Decimal(300));
    expect(result.eq(new Decimal(600))).toBe(true);
  });

  it('nullを無視して合計する', () => {
    const result = decimalSum(new Decimal(100), null, new Decimal(300));
    expect(result.eq(new Decimal(400))).toBe(true);
  });
});

describe('floorToYen', () => {
  it('小数点以下を切り捨てる', () => {
    expect(floorToYen(new Decimal('12345.67')).eq(new Decimal(12345))).toBe(true);
  });

  it('整数はそのまま返す', () => {
    expect(floorToYen(new Decimal(10000)).eq(new Decimal(10000))).toBe(true);
  });
});

describe('toDecimalOrNull', () => {
  it('数値をDecimalに変換する', () => {
    const result = toDecimalOrNull(5000000);
    expect(result).not.toBeNull();
    expect(result!.eq(new Decimal(5000000))).toBe(true);
  });

  it('nullはnullを返す', () => {
    expect(toDecimalOrNull(null)).toBeNull();
  });
});
