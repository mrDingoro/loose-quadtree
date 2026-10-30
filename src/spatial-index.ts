// SpatialIndex — публичная обёртка над квадродеревом.
// Дерево доверяет входным данным, а обёртка их проверяет и копирует границы.
// Если проверка не прошла, индекс остаётся таким, каким был.

import { checkAABB } from './aabb.js';
import type { AABB } from './aabb.js';
import { Quadtree } from './quadtree.js';
import type { Entry } from './quadtree.js';

export interface SpatialIndexOptions {
  /** Сколько объектов узел держит, прежде чем делиться. По умолчанию 8. */
  readonly capacity?: number;
  /** Запас рыхлой области в долях стороны ячейки, от 0 до 1. По умолчанию 0,25. */
  readonly looseness?: number;
}

export class SpatialIndex<T> {
  private readonly tree: Quadtree<T>;

  constructor(options: SpatialIndexOptions = {}) {
    const { capacity = 8, looseness = 0.25 } = options;
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be an integer of at least 1');
    }
    if (typeof looseness !== 'number' || !(looseness >= 0 && looseness <= 1)) {
      throw new RangeError('looseness must be a number from 0 to 1');
    }
    this.tree = new Quadtree<T>(capacity, looseness);
  }

  get size(): number {
    return this.tree.size;
  }

  /** Повторный id — ошибка: для перемещения есть update. */
  add(id: string, value: T, bounds: AABB): void {
    checkId(id);
    if (this.tree.has(id)) {
      throw new Error(`Object with id "${id}" is already in the index`);
    }
    this.tree.insert({ id, value, bounds: checkAABB(bounds) });
  }

  /** Индекс сам за объектами не следит: после перемещения нужно вызвать update. */
  update(id: string, value: T, bounds: AABB): void {
    checkId(id);
    if (!this.tree.has(id)) {
      throw new Error(`No object with id "${id}" in the index`);
    }
    this.tree.update({ id, value, bounds: checkAABB(bounds) });
  }

  /** Возвращает false, если такого id не было. */
  remove(id: string): boolean {
    return this.tree.remove(id);
  }

  has(id: string): boolean {
    return this.tree.has(id);
  }

  get(id: string): Entry<T> | undefined {
    return this.tree.get(id);
  }

  /** Касание считается пересечением. Порядок не гарантируется. */
  query(area: AABB): Entry<T>[] {
    return this.tree.query(checkAABB(area));
  }

  clear(): void {
    this.tree.clear();
  }
}

function checkId(id: string): void {
  if (typeof id !== 'string') {
    throw new TypeError('id must be a string');
  }
}
