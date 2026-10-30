import { describe, expect, it } from 'vitest';
import { checkAABB, contains, intersects } from '../src/aabb.js';

const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

describe('AABB', () => {
  it('пересечение: перекрытие, касание краем и углом считаются, зазор — нет', () => {
    expect(intersects(box, { minX: 5, minY: 5, maxX: 15, maxY: 15 })).toBe(true);
    expect(intersects(box, { minX: 10, minY: 0, maxX: 20, maxY: 10 })).toBe(true);
    expect(intersects(box, { minX: 10, minY: 10, maxX: 20, maxY: 20 })).toBe(true);
    expect(intersects(box, { minX: 11, minY: 0, maxX: 20, maxY: 10 })).toBe(false);
  });

  it('вложенность: внутренний прямоугольник может касаться границ внешнего', () => {
    expect(contains(box, { minX: 0, minY: 0, maxX: 10, maxY: 10 })).toBe(true);
    expect(contains(box, { minX: 2, minY: 2, maxX: 3, maxY: 3 })).toBe(true);
    expect(contains(box, { minX: 2, minY: 2, maxX: 11, maxY: 3 })).toBe(false);
  });

  it('проверка входа отклоняет NaN, бесконечность и перепутанные границы', () => {
    expect(() => checkAABB({ ...box, minX: NaN })).toThrow(RangeError);
    expect(() => checkAABB({ ...box, maxY: Infinity })).toThrow(RangeError);
    expect(() => checkAABB({ minX: 5, minY: 0, maxX: 1, maxY: 1 })).toThrow(RangeError);
  });

  it('проверка входа возвращает копию: изменение исходника её не трогает', () => {
    const input = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const copy = checkAABB(input);
    input.maxX = 100;
    expect(copy.maxX).toBe(1);
  });
});
