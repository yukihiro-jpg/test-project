import { describe, it, expect } from 'vitest';
import { getLifeExpectancyYears } from '@/lib/life-expectancy';

describe('getLifeExpectancyYears', () => {
  it('0歳男性の平均余命を返す', () => {
    expect(getLifeExpectancyYears(0, 'male')).toBe(81);
  });

  it('0歳女性の平均余命を返す', () => {
    expect(getLifeExpectancyYears(0, 'female')).toBe(87);
  });

  it('65歳男性の平均余命を返す', () => {
    expect(getLifeExpectancyYears(65, 'male')).toBe(20);
  });

  it('65歳女性の平均余命を返す', () => {
    expect(getLifeExpectancyYears(65, 'female')).toBe(25);
  });

  it('100歳男性の平均余命を返す', () => {
    expect(getLifeExpectancyYears(100, 'male')).toBe(3);
  });

  it('100を超える年齢は100にクランプされる', () => {
    expect(getLifeExpectancyYears(110, 'male')).toBe(3);
  });

  it('負の年齢は0にクラ��プされる', () => {
    expect(getLifeExpectancyYears(-5, 'female')).toBe(87);
  });
});
