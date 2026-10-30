// Фигуры SpatialSpace: прямоугольник, круг и точка. Тип фигуры — в поле kind.

import type { AABB } from './aabb.js';

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Прямоугольник: (x, y) — левый верхний угол. */
export interface Rectangle {
  readonly kind: 'rectangle';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Круг: (x, y) — центр. */
export interface Circle {
  readonly kind: 'circle';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface Point {
  readonly kind: 'point';
  readonly x: number;
  readonly y: number;
}

export type Shape = Rectangle | Circle | Point;

/** NaN и бесконечность сломали бы дерево. */
function finite(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
  return value;
}

function size(value: number, name: string): number {
  if (finite(value, name) < 0) {
    throw new RangeError(`${name} must not be negative`);
  }
  return value;
}

export function rectangle(input: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Rectangle {
  return {
    kind: 'rectangle',
    x: finite(input.x, 'x'),
    y: finite(input.y, 'y'),
    width: size(input.width, 'width'),
    height: size(input.height, 'height'),
  };
}

export function circle(input: { x: number; y: number; radius: number }): Circle {
  return {
    kind: 'circle',
    x: finite(input.x, 'x'),
    y: finite(input.y, 'y'),
    radius: size(input.radius, 'radius'),
  };
}

export function point(input: Vec2): Point {
  return { kind: 'point', x: finite(input.x, 'x'), y: finite(input.y, 'y') };
}

export function boundsOf(shape: Shape): AABB {
  switch (shape.kind) {
    case 'rectangle':
      return {
        minX: shape.x,
        minY: shape.y,
        maxX: shape.x + shape.width,
        maxY: shape.y + shape.height,
      };
    case 'circle':
      return {
        minX: shape.x - shape.radius,
        minY: shape.y - shape.radius,
        maxX: shape.x + shape.radius,
        maxY: shape.y + shape.radius,
      };
    case 'point':
      return { minX: shape.x, minY: shape.y, maxX: shape.x, maxY: shape.y };
  }
}

/** Для фигур, собранных вручную без rectangle() или circle(). Возвращает копию. */
export function checkShape(shape: Shape): Shape {
  switch (shape?.kind) {
    case 'rectangle':
      return rectangle(shape);
    case 'circle':
      return circle(shape);
    case 'point':
      return point(shape);
    default:
      throw new TypeError('Unknown shape: expected rectangle, circle or point');
  }
}
