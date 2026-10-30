import { describe, expect, it } from 'vitest';
import type { AABB } from '../src/aabb.js';
import { contains } from '../src/aabb.js';
import { Quadtree } from '../src/quadtree.js';
import type { Node } from '../src/quadtree.js';

function box(minX: number, minY: number, maxX: number, maxY: number): AABB {
  return { minX, minY, maxX, maxY };
}

function insert(tree: Quadtree<null>, id: string, bounds: AABB): void {
  tree.insert({ id, bounds, value: null });
}

function nodesOf(tree: Quadtree<null>): Node<null>[] {
  const result: Node<null>[] = [];
  const stack = tree.root ? [tree.root] : [];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return result;
}

function ownerOf(tree: Quadtree<null>, id: string): Node<null> | undefined {
  return nodesOf(tree).find((node) => node.entries.has(id));
}

function treeWithObjectOnSplitLine(looseness: number): Quadtree<null> {
  const tree = new Quadtree<null>(4, looseness);
  insert(tree, 'corner', box(0, 0, 64, 64));
  for (let i = 0; i < 16; i++) {
    const x = 4 + (i % 4) * 16;
    const y = 4 + Math.floor(i / 4) * 16;
    insert(tree, `small-${i}`, box(x, y, x + 1, y + 1));
  }
  insert(tree, 'on-line', box(31, 10, 33, 12));
  return tree;
}

describe('Quadtree', () => {
  it('первый корень — квадрат со стороной-степенью двойки от угла объекта', () => {
    const tree = new Quadtree<null>();
    insert(tree, 'a', box(10, 10, 15, 15));
    expect(tree.root!.cell).toEqual(box(10, 10, 18, 18));
  });

  it('объект, который пересекает ноль, тоже помещается в первый корень', () => {
    const tree = new Quadtree<null>();
    insert(tree, 'across-zero', box(-1, -3, 1, 2));
    expect(contains(tree.root!.cell, box(-1, -3, 1, 2))).toBe(true);
    expect(tree.query(box(0, 0, 0, 0)).map((e) => e.id)).toEqual(['across-zero']);
  });

  it('переполненный узел делится на четыре четверти, мелкие объекты уходят вниз', () => {
    const tree = new Quadtree<null>(2);
    insert(tree, 'frame', box(0, 0, 8, 8));
    insert(tree, 'a', box(0, 0, 1, 1));
    expect(tree.root!.children).toBeUndefined();
    insert(tree, 'b', box(7, 7, 8, 8));
    expect(tree.root!.children).toHaveLength(4);
    expect([...tree.root!.entries.keys()]).toEqual(['frame']);
  });

  it('рыхлое дерево спускает объект с линии раздела вниз', () => {
    const tree = treeWithObjectOnSplitLine(0.25);
    expect(ownerOf(tree, 'on-line')).not.toBe(tree.root);
  });

  it('обычное дерево (looseness = 0) оставляет такой объект в корне — это и была проблема', () => {
    const tree = treeWithObjectOnSplitLine(0);
    expect(ownerOf(tree, 'on-line')).toBe(tree.root);
  });

  it('крупный объект остаётся наверху и в рыхлом дереве', () => {
    const tree = treeWithObjectOnSplitLine(0.25);
    expect(ownerOf(tree, 'corner')).toBe(tree.root);
  });

  it('корень растёт к далёкому объекту, а старый корень целиком становится его четвертью', () => {
    const tree = new Quadtree<null>();
    insert(tree, 'a', box(0, 0, 1, 1));
    const oldRoot = tree.root!;
    insert(tree, 'left', box(-1, 0, -0.5, 0.5));
    expect(tree.root!.cell).toEqual(box(-1, 0, 1, 2));
    expect(tree.root!.children![1]).toBe(oldRoot);
    expect(ownerOf(tree, 'a')).toBe(oldRoot);
  });

  it('стопка объектов в одной точке не делит дерево бесконечно', () => {
    const tree = new Quadtree<null>(8);
    for (let i = 0; i < 1000; i++) {
      insert(tree, String(i), box(5, 5, 5, 5));
    }
    expect(tree.size).toBe(1000);
    expect(nodesOf(tree).length).toBeLessThan(200);
  });

  it('каждый объект лежит в рыхлой области своего узла и всех его предков', () => {
    const tree = new Quadtree<null>(2);
    for (let i = 0; i < 300; i++) {
      const x = (i * 37) % 200;
      const y = (i * 91) % 150;
      insert(tree, String(i), box(x, y, x + (i % 7), y + (i % 5)));
    }
    const check = (node: Node<null>, ancestors: Node<null>[]): void => {
      for (const entry of node.entries.values()) {
        for (const area of [node, ...ancestors]) {
          expect(contains(area.loose, entry.bounds)).toBe(true);
        }
      }
      for (const child of node.children ?? []) {
        check(child, [node, ...ancestors]);
      }
    };
    check(tree.root!, []);
  });

  it('удаление убирает объект', () => {
    const tree = treeWithObjectOnSplitLine(0.25);
    expect(tree.remove('small-3')).toBe(true);
    expect(tree.remove('small-3')).toBe(false);
    expect(tree.has('small-3')).toBe(false);
    expect(tree.query(box(0, 0, 64, 64)).map((e) => e.id)).not.toContain('small-3');
  });

  it('когда объекты уходят, опустевшие узлы склеиваются обратно', () => {
    const tree = new Quadtree<null>(4);
    insert(tree, 'frame', box(0, 0, 64, 64));
    for (let i = 0; i < 40; i++) {
      insert(tree, `dot-${i}`, box(i % 8, Math.floor(i / 8), i % 8, Math.floor(i / 8)));
    }
    expect(nodesOf(tree).length).toBeGreaterThan(5);
    for (let i = 0; i < 40; i++) {
      tree.remove(`dot-${i}`);
    }
    expect(nodesOf(tree)).toEqual([tree.root]);
    expect(tree.query(box(0, 0, 64, 64)).map((e) => e.id)).toEqual(['frame']);
  });

  it('движущаяся куча объектов не оставляет за собой след из пустых узлов', () => {
    const tree = new Quadtree<null>(8);
    insert(tree, 'world', box(0, 0, 1024, 1024));
    const at = (i: number, step: number) => {
      const x = step * 3 + (i % 10) * 2;
      const y = step * 3 + Math.floor(i / 10) * 2;
      return box(x, y, x + 1, y + 1);
    };
    for (let i = 0; i < 100; i++) {
      insert(tree, String(i), at(i, 0));
    }
    const nodesAtStart = nodesOf(tree).length;
    for (let step = 1; step <= 300; step++) {
      for (let i = 0; i < 100; i++) {
        tree.update({ id: String(i), bounds: at(i, step), value: null });
      }
    }
    expect(nodesOf(tree).length).toBeLessThan(nodesAtStart * 2);
  });

  it('перемещение переносит объект в новый узел', () => {
    const tree = treeWithObjectOnSplitLine(0.25);
    tree.update({ id: 'small-0', bounds: box(60, 60, 61, 61), value: null });
    expect(tree.query(box(59, 59, 62, 62)).map((e) => e.id)).toContain('small-0');
    expect(tree.query(box(3, 3, 6, 6)).map((e) => e.id)).not.toContain('small-0');
  });
});
