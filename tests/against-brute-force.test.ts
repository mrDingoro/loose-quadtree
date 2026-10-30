import { describe, expect, it } from 'vitest';
import {
  SpatialSpace,
  boundsOf,
  circle,
  distanceToPoint,
  point,
  rectangle,
  shapesIntersect,
} from '../src/index.js';
import type { Shape, SpatialObject } from '../src/index.js';

function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const ids = (objects: SpatialObject<null>[]) => objects.map((o) => o.id).sort();

const scenarios = [
  { name: 'случайные координаты', layout: 'random', looseness: 0.25 },
  {
    name: 'координаты на сетке (много объектов на линиях раздела)',
    layout: 'grid',
    looseness: 0.25,
  },
  { name: 'все объекты в одной точке', layout: 'same', looseness: 0.25 },
  { name: 'объекты вокруг нуля (пересекают оси)', layout: 'zero', looseness: 0.25 },
  { name: 'обычное дерево (looseness = 0)', layout: 'grid', looseness: 0 },
] as const;

describe('SpatialSpace против полного перебора', () => {
  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const next = random(2026);
      const coordinate = (): number => {
        if (scenario.layout === 'same') {
          return 500;
        }
        if (scenario.layout === 'zero') {
          return next() * 200 - 150;
        }
        if (scenario.layout === 'grid') {
          return Math.floor(next() * 16) * 64;
        }
        return next() * 2000 - 1000;
      };
      const randomShape = (): Shape => {
        const x = coordinate();
        const y = coordinate();
        const kind = next();
        if (kind < 0.4) {
          return rectangle({ x, y, width: next() * 100, height: next() * 100 });
        }
        return kind < 0.7 ? circle({ x, y, radius: next() * 50 }) : point({ x, y });
      };

      const space = new SpatialSpace<null>({ capacity: 4, looseness: scenario.looseness });
      const all = new Map<string, Shape>();
      const bruteForce = (test: (shape: Shape) => boolean): string[] =>
        [...all]
          .filter(([, shape]) => test(shape))
          .map(([id]) => id)
          .sort();

      for (let step = 0; step < 2000; step++) {
        const id = `object-${Math.floor(next() * 300)}`;
        if (next() < 0.25) {
          space.remove(id);
          all.delete(id);
        } else {
          const shape = randomShape();
          if (all.has(id)) {
            space.update(id, shape, null);
          } else {
            space.add(id, shape, null);
          }
          all.set(id, shape);
        }

        if (step % 10 !== 0) {
          continue;
        }
        const target = randomShape();
        const top = boundsOf(target).minY;
        const bottom = boundsOf(target).maxY;
        const center = { x: coordinate(), y: coordinate() };
        const radius = next() * 200;

        expect(space.size).toBe(all.size);
        expect(ids(space.findIntersections(target))).toEqual(
          bruteForce((shape) => shapesIntersect(shape, target)),
        );
        expect(ids(space.findAbove(target))).toEqual(
          bruteForce((shape) => boundsOf(shape).maxY < top),
        );
        expect(ids(space.findBelow(target))).toEqual(
          bruteForce((shape) => boundsOf(shape).minY > bottom),
        );
        expect(ids(space.findInRadius(center, radius))).toEqual(
          bruteForce((shape) => distanceToPoint(shape, center) <= radius),
        );
      }
    });
  }
});
