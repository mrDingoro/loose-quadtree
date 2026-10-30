// SpatialSpace — пространство фигур и запросы из задания.
// Каждый запрос в две фазы: индекс отбирает кандидатов по AABB,
// затем для них проверяется точное условие.

import type { AABB } from './aabb.js';
import { distanceToPoint, shapesIntersect } from './geometry.js';
import { boundsOf, checkShape, circle, point } from './shapes.js';
import type { Shape, Vec2 } from './shapes.js';
import { SpatialIndex } from './spatial-index.js';
import type { SpatialIndexOptions } from './spatial-index.js';

export interface SpatialObject<T> {
  readonly id: string;
  readonly shape: Shape;
  readonly data: T;
}

/** Граница полуплоскости для «выше» и «ниже». */
const EVERYWHERE = Number.MAX_VALUE;

export class SpatialSpace<T> {
  private readonly index: SpatialIndex<SpatialObject<T>>;

  constructor(options: SpatialIndexOptions = {}) {
    this.index = new SpatialIndex(options);
  }

  get size(): number {
    return this.index.size;
  }

  add(id: string, shape: Shape, data: T): void {
    const checked = checkShape(shape);
    this.index.add(id, { id, shape: checked, data }, boundsOf(checked));
  }

  update(id: string, shape: Shape, data: T): void {
    const checked = checkShape(shape);
    this.index.update(id, { id, shape: checked, data }, boundsOf(checked));
  }

  remove(id: string): boolean {
    return this.index.remove(id);
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  get(id: string): SpatialObject<T> | undefined {
    return this.index.get(id)?.value;
  }

  clear(): void {
    this.index.clear();
  }

  /** Касание считается пересечением. */
  findIntersections(shape: Shape): SpatialObject<T>[] {
    const target = checkShape(shape);
    return this.candidates(boundsOf(target)).filter((object) =>
      shapesIntersect(object.shape, target),
    );
  }

  /**
   * Нижний край объекта выше верхнего края фигуры (ось Y направлена вниз).
   * По X ограничения нет — это вся полуплоскость над фигурой.
   */
  findAbove(shape: Shape): SpatialObject<T>[] {
    const top = boundsOf(checkShape(shape)).minY;
    const halfPlane = { minX: -EVERYWHERE, maxX: EVERYWHERE, minY: -EVERYWHERE, maxY: top };
    return this.candidates(halfPlane).filter((object) => boundsOf(object.shape).maxY < top);
  }

  /** Верхний край объекта ниже нижнего края фигуры. */
  findBelow(shape: Shape): SpatialObject<T>[] {
    const bottom = boundsOf(checkShape(shape)).maxY;
    const halfPlane = { minX: -EVERYWHERE, maxX: EVERYWHERE, minY: bottom, maxY: EVERYWHERE };
    return this.candidates(halfPlane).filter((object) => boundsOf(object.shape).minY > bottom);
  }

  /** Расстояние считается до ближайшей точки фигуры, а не до её центра. */
  findInRadius(center: Vec2, radius: number): SpatialObject<T>[] {
    const search = circle({ x: center.x, y: center.y, radius });
    const from = point(search);
    return this.candidates(boundsOf(search)).filter(
      (object) => distanceToPoint(object.shape, from) <= search.radius,
    );
  }

  /** Широкая фаза. */
  private candidates(area: AABB): SpatialObject<T>[] {
    return this.index.query(area).map((entry) => entry.value);
  }
}
