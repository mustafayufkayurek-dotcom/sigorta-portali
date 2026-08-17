import {
  areaFromWidthHeightMm,
  applyMultiplier,
  lengthMmToM,
  roundQuantity,
} from '../calculation-engine/calculation.math';

describe('CalculationEngine math (pure)', () => {
  it('2100×900 mm → 1.89 m²', () => {
    expect(roundQuantity(areaFromWidthHeightMm(2100, 900))).toBe(1.89);
  });

  it('applies coat multiplier', () => {
    const area = areaFromWidthHeightMm(2100, 900);
    expect(roundQuantity(applyMultiplier(area, 2))).toBe(3.78);
  });

  it('length mm → m', () => {
    expect(roundQuantity(lengthMmToM(4500))).toBe(4.5);
  });

  it('rejects negative dimensions', () => {
    expect(() => areaFromWidthHeightMm(-1, 900)).toThrow();
  });
});
