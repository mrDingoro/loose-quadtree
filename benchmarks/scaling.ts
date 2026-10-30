import type { AABB } from '../src/aabb.js';
import { contains, intersects } from '../src/aabb.js';
import { Quadtree } from '../src/quadtree.js';
import type { Entry } from '../src/quadtree.js';

type Layout = 'равномерно' | 'плотные кучи' | '10% огромных';

const LAYOUTS: Layout[] = ['равномерно', 'плотные кучи', '10% огромных'];
const QUERY_SIDE = 16;
const QUERIES = 20_000;
const BRUTE_FORCE_QUERIES = 200;

function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function generate(n: number, layout: Layout): { entries: Entry<null>[]; worldSide: number } {
  const next = random(2026);
  const worldSide = Math.ceil(Math.sqrt(n) * 16);
  const entries: Entry<null>[] = [];
  for (let i = 0; i < n; i++) {
    let x = Math.floor(next() * (worldSide - 8));
    let y = Math.floor(next() * (worldSide - 8));
    let size = 2;
    if (layout === 'плотные кучи') {
      const pile = i % 4;
      x = Math.floor(worldSide * (pile % 2 ? 0.75 : 0.25)) + Math.floor(next() * 32) - 16;
      y = Math.floor(worldSide * (pile < 2 ? 0.25 : 0.75)) + Math.floor(next() * 32) - 16;
    }
    if (layout === '10% огромных' && i % 10 === 0) {
      size = worldSide / 4;
    }
    entries.push({
      id: String(i),
      value: null,
      bounds: { minX: x, minY: y, maxX: x + size, maxY: y + size },
    });
  }
  return { entries, worldSide };
}

function countChecked(tree: Quadtree<null>, area: AABB): number {
  let checked = 0;
  const stack = tree.root ? [tree.root] : [];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!intersects(node.loose, area) || contains(area, node.loose)) {
      continue;
    }
    checked += node.entries.size;
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return checked;
}

function microseconds(queries: AABB[], run: (area: AABB) => unknown): number {
  let best = Infinity;
  for (let pass = 0; pass < 3; pass++) {
    const start = performance.now();
    for (const area of queries) {
      run(area);
    }
    best = Math.min(best, ((performance.now() - start) / queries.length) * 1000);
  }
  return best;
}

function format(value: number): string {
  return value < 10
    ? value.toFixed(2)
    : value < 100
      ? value.toFixed(1)
      : Math.round(value).toString();
}

const sizesArgument = process.argv.indexOf('--sizes');
const sizes =
  sizesArgument >= 0
    ? process.argv[sizesArgument + 1].split(',').map(Number)
    : [1_000, 10_000, 100_000, 1_000_000];

for (const layout of LAYOUTS) {
  const rows = [];
  for (const n of sizes) {
    const { entries, worldSide } = generate(n, layout);
    const loose = new Quadtree<null>(8, 0.25);
    const plain = new Quadtree<null>(8, 0);
    for (const entry of entries) {
      loose.insert(entry);
      plain.insert(entry);
    }

    const next = random(7);
    const queries: AABB[] = [];
    for (let i = 0; i < QUERIES; i++) {
      const x = next() * worldSide;
      const y = next() * worldSide;
      queries.push({ minX: x, minY: y, maxX: x + QUERY_SIDE, maxY: y + QUERY_SIDE });
    }
    const sample = queries.slice(0, BRUTE_FORCE_QUERIES);
    const average = (tree: Quadtree<null>) =>
      sample.reduce((sum, area) => sum + countChecked(tree, area), 0) / sample.length;

    rows.push({
      объектов: n.toLocaleString('ru-RU'),
      'обычное: записей': Math.round(average(plain)),
      'рыхлое: записей': Math.round(average(loose)),
      'обычное, мкс': format(microseconds(queries, (area) => plain.query(area))),
      'рыхлое, мкс': format(microseconds(queries, (area) => loose.query(area))),
      'перебор, мкс': format(
        microseconds(sample, (area) => entries.filter((entry) => intersects(entry.bounds, area))),
      ),
    });
  }
  console.log(`\n${layout}: один запрос ${QUERY_SIDE}×${QUERY_SIDE}`);
  console.table(rows);
}
