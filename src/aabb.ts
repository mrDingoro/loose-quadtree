// AABB (axis-aligned bounding box) — прямоугольник со сторонами вдоль осей.
// Дерево хранит и сравнивает только их; точная форма проверяется потом.
// Ось Y направлена вниз, как на экране: minY — верхний край.

export interface AABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Касание краями тоже считается пересечением. */
export function intersects(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Границы inner и outer могут совпадать. */
export function contains(outer: AABB, inner: AABB): boolean {
  return (
    outer.minX <= inner.minX &&
    outer.maxX >= inner.maxX &&
    outer.minY <= inner.minY &&
    outer.maxY >= inner.maxY
  );
}

/**
 * Проверяет прямоугольник и возвращает копию: иначе внешний код мог бы сдвинуть
 * объект, уже лежащий в дереве, и запросы перестали бы его находить.
 */
export function checkAABB(bounds: AABB): AABB {
  const { minX, minY, maxX, maxY } = bounds;
  for (const value of [minX, minY, maxX, maxY]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new RangeError('AABB bounds must be finite numbers');
    }
  }
  if (minX > maxX || minY > maxY) {
    throw new RangeError('AABB minimum must not be greater than maximum');
  }
  return { minX, minY, maxX, maxY };
}
