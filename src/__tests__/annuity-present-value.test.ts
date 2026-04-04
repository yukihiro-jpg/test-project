import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { compoundAnnuityPresentValueFactor } from '@/lib/annuity-present-value';

describe('compoundAnnuityPresentValueFactor', () => {
  it('利率1.5%、10年の場合の複利年金現価率を計算する', () => {
    const factor = compoundAnnuityPresentValueFactor(10, new Decimal('0.015'));
    // 手計算: (1 - 1.015^(-10)) / 0.015 ≈ 9.2222
    expect(factor.toFixed(4)).toBe('9.2222');
  });

  it('利率2.0%、20年の場合の複利年金現価率を計算する', () => {
    const factor = compoundAnnuityPresentValueFactor(20, new Decimal('0.02'));
    // 手計算: (1 - 1.02^(-20)) / 0.02 ≈ 16.3514
    expect(factor.toFixed(4)).toBe('16.3514');
  });

  it('利率0%の場合は年数をそのまま返す', () => {
    const factor = compoundAnnuityPresentValueFactor(10, new Decimal(0));
    expect(factor.eq(new Decimal(10))).toBe(true);
  });

  it('年数0の場合は0を返す', () => {
    const factor = compoundAnnuityPresentValueFactor(0, new Decimal('0.015'));
    expect(factor.eq(new Decimal(0))).toBe(true);
  });

  it('年数が負の場合は0を返す', () => {
    const factor = compoundAnnuityPresentValueFactor(-5, new Decimal('0.015'));
    expect(factor.eq(new Decimal(0))).toBe(true);
  });
});
