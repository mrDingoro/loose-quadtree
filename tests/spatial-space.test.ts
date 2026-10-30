import { describe, expect, it } from 'vitest';
import { SpatialSpace, circle, point, rectangle } from '../src/index.js';
import type { SpatialObject } from '../src/index.js';

const ids = (objects: SpatialObject<unknown>[]) => objects.map((o) => o.id).sort();

function scene(): SpatialSpace<string> {
  const space = new SpatialSpace<string>();
  space.add('wall', rectangle({ x: 0, y: 0, width: 10, height: 10 }), 'стена');
  space.add('coin', point({ x: 12, y: 5 }), 'монета');
  space.add('lamp', circle({ x: 5, y: -20, radius: 3 }), 'фонарь');
  space.add('enemy', rectangle({ x: 100, y: 40, width: 4, height: 4 }), 'враг');
  return space;
}

describe('SpatialSpace', () => {
  it('хранит фигуру и данные объекта', () => {
    const space = scene();
    expect(space.size).toBe(4);
    expect(space.get('coin')?.data).toBe('монета');
    expect(space.get('coin')?.shape).toEqual({ kind: 'point', x: 12, y: 5 });
  });

  it('findIntersections: точная форма, касание считается', () => {
    const space = scene();
    expect(ids(space.findIntersections(circle({ x: 12, y: 5, radius: 2 })))).toEqual([
      'coin',
      'wall',
    ]);
  });

  it('findAbove: всё, что целиком выше фигуры, по всей ширине мира', () => {
    const space = scene();
    expect(ids(space.findAbove(point({ x: 500, y: 0 })))).toEqual(['lamp']);
  });

  it('findAbove: объект, который касается фигуры по вертикали, не считается выше', () => {
    const space = scene();
    expect(ids(space.findAbove(point({ x: 0, y: -17 })))).toEqual([]);
  });

  it('findBelow: всё, что целиком ниже фигуры', () => {
    const space = scene();
    expect(ids(space.findBelow(rectangle({ x: 0, y: 0, width: 1, height: 20 })))).toEqual([
      'enemy',
    ]);
  });

  it('findInRadius: расстояние до края фигуры, а не до её центра', () => {
    const space = scene();
    expect(ids(space.findInRadius({ x: 15, y: 5 }, 5))).toEqual(['coin', 'wall']);
    expect(ids(space.findInRadius({ x: 15, y: 5 }, 3))).toEqual(['coin']);
  });

  it('update перемещает фигуру, remove убирает', () => {
    const space = scene();
    space.update('coin', point({ x: 100, y: 100 }), 'монета');
    expect(ids(space.findInRadius({ x: 12, y: 5 }, 1))).toEqual([]);
    expect(space.remove('wall')).toBe(true);
    expect(ids(space.findIntersections(point({ x: 5, y: 5 })))).toEqual([]);
  });

  it('некорректная фигура отклоняется, пространство не меняется', () => {
    const space = scene();
    const broken = { kind: 'circle', x: 0, y: 0, radius: -1 } as const;
    expect(() => space.update('coin', broken, 'x')).toThrow(RangeError);
    expect(space.get('coin')?.shape).toEqual({ kind: 'point', x: 12, y: 5 });
  });
});
