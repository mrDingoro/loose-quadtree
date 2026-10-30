import { describe, expect, it } from 'vitest';
import { SpatialIndex } from '../src/index.js';

const box = (x: number, y: number, size = 1) => ({
  minX: x,
  minY: y,
  maxX: x + size,
  maxY: y + size,
});

describe('SpatialIndex', () => {
  it('add, has, get, size', () => {
    const index = new SpatialIndex<string>();
    index.add('lamp', 'фонарь', box(0, 0));
    expect(index.has('lamp')).toBe(true);
    expect(index.get('lamp')?.value).toBe('фонарь');
    expect(index.size).toBe(1);
  });

  it('query находит объекты в области, касание считается', () => {
    const index = new SpatialIndex<null>();
    index.add('a', null, box(0, 0));
    index.add('b', null, box(5, 5));
    index.add('c', null, box(100, 100));
    const ids = index.query({ minX: 1, minY: 1, maxX: 5, maxY: 5 }).map((e) => e.id);
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('update перемещает объект', () => {
    const index = new SpatialIndex<null>();
    index.add('a', null, box(0, 0));
    index.update('a', null, box(50, 50));
    expect(index.query(box(0, 0))).toHaveLength(0);
    expect(index.query(box(50, 50))).toHaveLength(1);
  });

  it('remove и clear', () => {
    const index = new SpatialIndex<null>();
    index.add('a', null, box(0, 0));
    index.add('b', null, box(1, 1));
    expect(index.remove('a')).toBe(true);
    expect(index.remove('a')).toBe(false);
    index.clear();
    expect(index.size).toBe(0);
    index.add('a', null, box(0, 0));
    expect(index.size).toBe(1);
  });

  it('повторный id в add и неизвестный id в update — ошибки', () => {
    const index = new SpatialIndex<null>();
    index.add('a', null, box(0, 0));
    expect(() => index.add('a', null, box(1, 1))).toThrow();
    expect(() => index.update('nope', null, box(1, 1))).toThrow();
  });

  it('при некорректных границах индекс не меняется', () => {
    const index = new SpatialIndex<string>();
    index.add('a', 'старое', box(0, 0));
    expect(() => index.update('a', 'новое', { ...box(5, 5), minX: NaN })).toThrow(RangeError);
    expect(() => index.add('b', 'b', { minX: 1, minY: 0, maxX: 0, maxY: 1 })).toThrow(RangeError);
    expect(index.get('a')?.value).toBe('старое');
    expect(index.query(box(0, 0))).toHaveLength(1);
    expect(index.size).toBe(1);
  });

  it('изменение объекта границ после add не ломает индекс', () => {
    const index = new SpatialIndex<null>();
    const bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    index.add('a', null, bounds);
    bounds.minX = 500;
    bounds.maxX = 501;
    expect(index.query(box(0, 0))).toHaveLength(1);
  });

  it('проверяет настройки', () => {
    expect(() => new SpatialIndex({ capacity: 0 })).toThrow(RangeError);
    expect(() => new SpatialIndex({ looseness: 2 })).toThrow(RangeError);
  });
});
