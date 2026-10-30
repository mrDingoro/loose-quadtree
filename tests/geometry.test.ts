import { describe, expect, it } from 'vitest';
import { distanceToPoint, shapesIntersect } from '../src/geometry.js';
import { boundsOf, checkShape, circle, point, rectangle } from '../src/shapes.js';
import type { Shape } from '../src/shapes.js';

const square = rectangle({ x: 0, y: 0, width: 10, height: 10 });

describe('фигуры', () => {
  it('отклоняют отрицательный размер и нечисловые координаты', () => {
    expect(() => rectangle({ x: 0, y: 0, width: -1, height: 1 })).toThrow(RangeError);
    expect(() => circle({ x: 0, y: 0, radius: -1 })).toThrow(RangeError);
    expect(() => point({ x: NaN, y: 0 })).toThrow(RangeError);
  });

  it('нулевой размер допустим: прямоугольник может быть отрезком', () => {
    expect(rectangle({ x: 0, y: 0, width: 0, height: 5 }).width).toBe(0);
  });

  it('незнакомая фигура отклоняется', () => {
    expect(() => checkShape({ kind: 'triangle' } as unknown as Shape)).toThrow(TypeError);
  });

  it('AABB круга — описанный квадрат, AABB точки — сама точка', () => {
    expect(boundsOf(circle({ x: 5, y: 5, radius: 2 }))).toEqual({
      minX: 3,
      minY: 3,
      maxX: 7,
      maxY: 7,
    });
    expect(boundsOf(point({ x: 1, y: 2 }))).toEqual({ minX: 1, minY: 2, maxX: 1, maxY: 2 });
  });
});

describe('точное пересечение фигур (все шесть пар)', () => {
  it('прямоугольник и прямоугольник, включая касание', () => {
    expect(shapesIntersect(square, rectangle({ x: 10, y: 5, width: 5, height: 5 }))).toBe(true);
    expect(shapesIntersect(square, rectangle({ x: 11, y: 5, width: 5, height: 5 }))).toBe(false);
  });

  it('прямоугольник и круг: угол AABB круга задевает квадрат, а сам круг — нет', () => {
    const nearCorner = circle({ x: 11.5, y: 11.5, radius: 2 });
    expect(shapesIntersect(square, nearCorner)).toBe(false);
    expect(shapesIntersect(nearCorner, square)).toBe(false);
    expect(shapesIntersect(square, circle({ x: 12, y: 5, radius: 2 }))).toBe(true);
  });

  it('круг и круг: касание считается', () => {
    const a = circle({ x: 0, y: 0, radius: 3 });
    expect(shapesIntersect(a, circle({ x: 5, y: 0, radius: 2 }))).toBe(true);
    expect(shapesIntersect(a, circle({ x: 5.1, y: 0, radius: 2 }))).toBe(false);
  });

  it('точка с прямоугольником, кругом и точкой', () => {
    expect(shapesIntersect(point({ x: 10, y: 10 }), square)).toBe(true);
    expect(shapesIntersect(square, point({ x: 10.1, y: 10 }))).toBe(false);
    expect(shapesIntersect(point({ x: 3, y: 4 }), circle({ x: 0, y: 0, radius: 5 }))).toBe(true);
    expect(shapesIntersect(point({ x: 1, y: 1 }), point({ x: 1, y: 1 }))).toBe(true);
    expect(shapesIntersect(point({ x: 1, y: 1 }), point({ x: 1, y: 2 }))).toBe(false);
  });
});

describe('расстояние от точки до фигуры', () => {
  it('считается до ближайшей точки фигуры, внутри равно нулю', () => {
    expect(distanceToPoint(square, { x: 5, y: 5 })).toBe(0);
    expect(distanceToPoint(square, { x: 13, y: 14 })).toBe(5);
    expect(distanceToPoint(square, { x: 5, y: -2 })).toBe(2);
    expect(distanceToPoint(circle({ x: 0, y: 0, radius: 1 }), { x: 4, y: 0 })).toBe(3);
    expect(distanceToPoint(point({ x: 0, y: 0 }), { x: 3, y: 4 })).toBe(5);
  });
});
