import { SpatialIndex } from '../src/index.js';
import type { AABB } from '../src/index.js';

interface Enemy {
  readonly id: string;
  x: number;
  y: number;
  readonly radius: number;
}

const ARENA = 3200;
const SPEED = 2;
const GUNS = 6;
const GUN_RANGE = 400;
const EXPLOSION = 120;

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function bounds(e: Enemy): AABB {
  return { minX: e.x - e.radius, minY: e.y - e.radius, maxX: e.x + e.radius, maxY: e.y + e.radius };
}

function around(x: number, y: number, r: number): AABB {
  return { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r };
}

function spawn(n: number): Enemy[] {
  const next = random(2026);
  return Array.from({ length: n }, (_, i) => ({
    id: `enemy-${i}`,
    x: next() * ARENA,
    y: next() * ARENA,
    radius: 10 + next() * 10,
  }));
}

function step(e: Enemy): void {
  const dx = ARENA / 2 - e.x;
  const dy = ARENA / 2 - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.x += (dx / d) * SPEED;
  e.y += (dy / d) * SPEED;
}

function push(a: Enemy, b: Enemy): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const overlap = a.radius + b.radius - Math.hypot(dx, dy);
  if (overlap <= 0 || a === b) {
    return 0;
  }
  const d = Math.hypot(dx, dy) || 1;
  a.x += (dx / d) * overlap * 0.25;
  a.y += (dy / d) * overlap * 0.25;
  return 1;
}

function nearest(candidates: Iterable<Enemy>, x: number, y: number): Enemy | undefined {
  let best: Enemy | undefined;
  let bestDistance = GUN_RANGE;
  for (const e of candidates) {
    const d = Math.hypot(e.x - x, e.y - y) - e.radius;
    if (d <= bestDistance) {
      bestDistance = d;
      best = e;
    }
  }
  return best;
}

function frameIndexed(enemies: Enemy[], index: SpatialIndex<Enemy>): number {
  let check = 0;
  for (const e of enemies) {
    step(e);
    index.update(e.id, e, bounds(e));
  }
  for (const e of enemies) {
    for (const entry of index.query(around(e.x, e.y, e.radius * 2))) {
      check += push(e, entry.value);
    }
  }
  for (const e of enemies) {
    index.update(e.id, e, bounds(e));
  }
  for (let g = 0; g < GUNS; g++) {
    const x = ARENA / 2 + g * 10;
    const target = nearest(
      index.query(around(x, ARENA / 2, GUN_RANGE)).map((entry) => entry.value),
      x,
      ARENA / 2,
    );
    check += target ? 1 : 0;
  }
  for (const entry of index.query(around(ARENA / 2, ARENA / 2, EXPLOSION))) {
    const e = entry.value;
    check += Math.hypot(e.x - ARENA / 2, e.y - ARENA / 2) <= EXPLOSION + e.radius ? 1 : 0;
  }
  return check;
}

function frameLinear(enemies: Enemy[]): number {
  let check = 0;
  for (const e of enemies) {
    step(e);
  }
  for (const e of enemies) {
    const r = e.radius * 2;
    for (const other of enemies) {
      if (
        Math.abs(other.x - e.x) <= r + other.radius &&
        Math.abs(other.y - e.y) <= r + other.radius
      ) {
        check += push(e, other);
      }
    }
  }
  for (let g = 0; g < GUNS; g++) {
    const x = ARENA / 2 + g * 10;
    check += nearest(enemies, x, ARENA / 2) ? 1 : 0;
  }
  for (const e of enemies) {
    check += Math.hypot(e.x - ARENA / 2, e.y - ARENA / 2) <= EXPLOSION + e.radius ? 1 : 0;
  }
  return check;
}

function measure(frames: number, frame: () => number): { ms: number; check: number } {
  let check = 0;
  frame();
  const start = performance.now();
  for (let i = 0; i < frames; i++) {
    check += frame();
  }
  return { ms: (performance.now() - start) / frames, check };
}

const rows = [];
for (const n of [100, 300, 1000, 3000, 10000]) {
  const frames = n <= 1000 ? 60 : n <= 3000 ? 10 : 3;
  const a = spawn(n);
  const index = new SpatialIndex<Enemy>();
  for (const e of a) {
    index.add(e.id, e, bounds(e));
  }
  const b = spawn(n);
  const indexed = measure(frames, () => frameIndexed(a, index));
  const linear = measure(frames, () => frameLinear(b));
  rows.push({
    врагов: n,
    'индекс, мс/кадр': indexed.ms.toFixed(2),
    'перебор, мс/кадр': linear.ms.toFixed(2),
    ускорение: `${(linear.ms / indexed.ms).toFixed(1)}×`,
  });
}
console.table(rows);
console.log('Бюджет кадра при 60 FPS — 16.7 мс (на всё: логика, отрисовка, звук).');
