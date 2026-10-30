// Точная геометрия — узкая фаза поиска. У круга AABB — описанный квадрат, его углы
// лежат вне круга, поэтому кандидатов из дерева нужно проверить по настоящей форме.
// Фигуры считаются заполненными, касание — пересечением.

import type { Circle, Rectangle, Shape, Vec2 } from './shapes.js';

/** Если p внутри прямоугольника — сама p. */
function closestPointOnRectangle(rect: Rectangle, p: Vec2): Vec2 {
  return {
    x: Math.min(Math.max(p.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(p.y, rect.y), rect.y + rect.height),
  };
}

function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 0, если точка внутри фигуры или на границе. */
export function distanceToPoint(shape: Shape, p: Vec2): number {
  switch (shape.kind) {
    case 'rectangle':
      return distanceBetween(p, closestPointOnRectangle(shape, p));
    case 'circle':
      return Math.max(0, distanceBetween(p, shape) - shape.radius);
    case 'point':
      return distanceBetween(p, shape);
  }
}

function rectanglesIntersect(a: Rectangle, b: Rectangle): boolean {
  return (
    a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
  );
}

/** Круг пересекает прямоугольник, если ближайшая к центру точка прямоугольника лежит в круге. */
function rectangleCircleIntersect(rect: Rectangle, c: Circle): boolean {
  return distanceToPoint(rect, c) <= c.radius;
}

function circlesIntersect(a: Circle, b: Circle): boolean {
  return distanceBetween(a, b) <= a.radius + b.radius;
}

/** Точка пересекает фигуру, если расстояние от неё до фигуры равно нулю. */
export function shapesIntersect(a: Shape, b: Shape): boolean {
  if (a.kind === 'point') {
    return distanceToPoint(b, a) === 0;
  }
  if (b.kind === 'point') {
    return distanceToPoint(a, b) === 0;
  }
  if (a.kind === 'rectangle') {
    return b.kind === 'rectangle' ? rectanglesIntersect(a, b) : rectangleCircleIntersect(a, b);
  }
  return b.kind === 'rectangle' ? rectangleCircleIntersect(b, a) : circlesIntersect(a, b);
}
