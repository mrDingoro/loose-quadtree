import { SpatialIndex, SpatialSpace, circle, point, rectangle } from '../src/index.js';
import type { AABB, SpatialObject } from '../src/index.js';

const names = (list: SpatialObject<string>[]) =>
  list
    .map((object) => object.data)
    .sort()
    .join(', ') || '—';

// 1. Фигуры и запросы из задания.
const space = new SpatialSpace<string>();
space.add('wall', rectangle({ x: 0, y: 0, width: 10, height: 10 }), 'стена');
space.add('coin', point({ x: 12, y: 5 }), 'монета');
space.add('lamp', circle({ x: 5, y: -20, radius: 3 }), 'фонарь');

console.log('Пересекают круг:', names(space.findIntersections(circle({ x: 12, y: 5, radius: 2 }))));
console.log('В радиусе 3 от (15, 5):', names(space.findInRadius({ x: 15, y: 5 }, 3)));
console.log(
  'Выше стены:',
  names(space.findAbove(rectangle({ x: 0, y: 0, width: 10, height: 10 }))),
);
console.log('Ниже фонаря:', names(space.findBelow(circle({ x: 5, y: -20, radius: 3 }))));

space.update('coin', point({ x: 100, y: 100 }), 'монета');
console.log(
  'После перемещения монеты, в радиусе 3 от (15, 5):',
  names(space.findInRadius({ x: 15, y: 5 }, 3)),
);

// 2. Индекс с любыми данными — например, враги в игре.
interface Enemy {
  id: string;
  x: number;
  y: number;
  radius: number;
}

const boundsOf = (e: Enemy): AABB => ({
  minX: e.x - e.radius,
  minY: e.y - e.radius,
  maxX: e.x + e.radius,
  maxY: e.y + e.radius,
});

const enemies = new SpatialIndex<Enemy>();
const horde: Enemy[] = [
  { id: 'frog', x: 30, y: 40, radius: 8 },
  { id: 'crab', x: 200, y: 50, radius: 12 },
  { id: 'eel', x: 60, y: 90, radius: 6 },
];
for (const enemy of horde) {
  enemies.add(enemy.id, enemy, boundsOf(enemy));
}

function nearestEnemy(x: number, y: number, range: number): Enemy | undefined {
  const area = { minX: x - range, minY: y - range, maxX: x + range, maxY: y + range };
  let best: Enemy | undefined;
  let bestDistance = range;
  for (const { value: enemy } of enemies.query(area)) {
    const distance = Math.hypot(enemy.x - x, enemy.y - y) - enemy.radius;
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }
  return best;
}

console.log('Ближайший к игроку в (50, 50):', nearestEnemy(50, 50, 100)?.id);

// Каждый кадр: сначала все двигаются, потом индекс обновляется один раз.
for (const enemy of horde) {
  enemy.x += 150;
}
for (const enemy of horde) {
  enemies.update(enemy.id, enemy, boundsOf(enemy));
}
console.log('После шага вправо ближайший к (50, 50):', nearestEnemy(50, 50, 100)?.id ?? 'никого');

enemies.remove('crab');
console.log('Врагов осталось:', enemies.size);
