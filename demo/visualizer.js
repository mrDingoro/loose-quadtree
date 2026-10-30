import { Quadtree } from './lib/quadtree.js';
import { contains, intersects } from './lib/aabb.js';
import { boundsOf, circle, point, rectangle } from './lib/shapes.js';
import { distanceToPoint, shapesIntersect } from './lib/geometry.js';

const WORLD = { width: 2400, height: 1500 };
const MOVING_LIMIT = 10000;

const colors = {
  cell: '#dde6e3',
  teal: '#0e7c7b',
  found: '#f5b400',
  stuck: '#d6365a',
  object: '#a3b0b5',
  wall: '#7d8b91',
  query: '#1e2a33',
};

const settings = {
  tree: 'loose',
  count: 2000,
  layout: 'shapes',
  query: 'square',
  size: 120,
  moving: false,
  showLoose: true,
};

const canvas = document.getElementById('view');
const context = canvas.getContext('2d');
let mouse = { x: WORLD.width / 2, y: WORLD.height / 2 };
let objects = [];
let tree = null;
let needsDraw = true;
let backgroundDirty = true;
const background = document.createElement('canvas');
let stuck = new Set();
let timingTimer = 0;
let lastTiming = 0;

function random(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function generateObjects() {
  const next = random(2026);
  const piles = Array.from({ length: 8 }, () => ({
    x: 200 + next() * (WORLD.width - 400),
    y: 200 + next() * (WORLD.height - 400),
  }));
  const list = [];
  for (let i = 0; i < settings.count; i++) {
    const x = next() * WORLD.width;
    const y = next() * WORLD.height;
    const kind = next();
    let shape;
    if (settings.layout === 'tiles') {
      const pile = piles[i % piles.length];
      const tx = i === 0 ? 0 : Math.round((pile.x + (next() - 0.5) * 360) / 32) * 32;
      const ty = i === 0 ? 0 : Math.round((pile.y + (next() - 0.5) * 360) / 32) * 32;
      shape =
        kind < 0.5
          ? rectangle({ x: tx - 4, y: ty - 4, width: 8, height: 8 })
          : circle({ x: tx, y: ty, radius: 4 });
    } else if (kind < 0.4) {
      shape = circle({ x, y, radius: 3 + next() * 6 });
    } else if (kind < 0.75) {
      shape = rectangle({ x, y, width: 4 + next() * 10, height: 4 + next() * 10 });
    } else if (kind < 0.98) {
      shape = point({ x, y });
    } else if (next() < 0.5) {
      shape = rectangle({ x, y, width: 60 + next() * 200, height: 4 });
    } else {
      shape = rectangle({ x, y, width: 4, height: 60 + next() * 200 });
    }
    const speed = 80;
    list.push({ id: String(i), shape, vx: (next() - 0.5) * speed, vy: (next() - 0.5) * speed });
  }
  return list;
}

function entryOf(object) {
  return { id: object.id, bounds: boundsOf(object.shape), value: object };
}

function rebuild() {
  objects = generateObjects();
  tree = new Quadtree(8, settings.tree === 'loose' ? 0.25 : 0);
  for (const object of objects) {
    tree.insert(entryOf(object));
  }
  backgroundDirty = true;
  needsDraw = true;
}

function currentQuery() {
  const { x, y } = mouse;
  const s = settings.size;
  if (settings.query === 'square') {
    const target = rectangle({ x: x - s / 2, y: y - s / 2, width: s, height: s });
    return {
      area: boundsOf(target),
      exact: (object) => shapesIntersect(object.shape, target),
      target,
    };
  }
  if (settings.query === 'circle') {
    const target = circle({ x, y, radius: s / 2 });
    return {
      area: boundsOf(target),
      exact: (object) => distanceToPoint(object.shape, mouse) <= target.radius,
      target,
    };
  }
  const target = rectangle({ x: x - s / 2, y: y - 4, width: s, height: 8 });
  const far = 1e9;
  if (settings.query === 'above') {
    return {
      area: { minX: -far, minY: -far, maxX: far, maxY: target.y },
      exact: (object) => boundsOf(object.shape).maxY < target.y,
      target,
      half: 'above',
    };
  }
  return {
    area: { minX: -far, minY: target.y + target.height, maxX: far, maxY: far },
    exact: (object) => boundsOf(object.shape).minY > target.y + target.height,
    target,
    half: 'below',
  };
}

function walk(area) {
  const visited = [];
  let checked = 0;
  const stack = tree.root ? [tree.root] : [];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!intersects(node.loose, area)) {
      continue;
    }
    visited.push(node);
    if (contains(area, node.loose)) {
      continue;
    }
    checked += node.entries.size;
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return { visited, checked };
}

function stuckNearTop() {
  const ids = new Set();
  const stack = tree.root ? [[tree.root, 0]] : [];
  while (stack.length > 0) {
    const [node, depth] = stack.pop();
    for (const id of node.entries.keys()) {
      ids.add(id);
    }
    if (node.children && depth < 2) {
      for (const child of node.children) {
        stack.push([child, depth + 1]);
      }
    }
  }
  return ids;
}

function measure(run) {
  let calls = 0;
  const start = performance.now();
  let now = start;
  while ((now - start < 4 || calls < 3) && calls < 5000) {
    run();
    calls++;
    now = performance.now();
  }
  return ((now - start) / calls) * 1000;
}

const formatNumber = (value) => value.toLocaleString('ru-RU');
const formatTime = (us) =>
  us < 1000 ? `${us < 10 ? us.toFixed(1) : Math.round(us)} мкс` : `${(us / 1000).toFixed(1)} мс`;

function show(id, text) {
  document.getElementById(id).textContent = text;
}

function measureTimes(query) {
  lastTiming = performance.now();
  const viaTree = measure(() => tree.query(query.area).filter((entry) => query.exact(entry.value)));
  const viaLoop = measure(() =>
    objects.filter((o) => intersects(boundsOf(o.shape), query.area) && query.exact(o)),
  );
  show('time-tree', formatTime(viaTree));
  show('time-linear', formatTime(viaLoop));
}

function updateNumbers(query, result, walked) {
  show('checked', formatNumber(walked.checked));
  show('nodes', formatNumber(walked.visited.length));
  show('candidates', formatNumber(result.candidates.length));
  show('found', formatNumber(result.found.size));
  show('stuck', formatNumber(stuck.size));
  clearTimeout(timingTimer);
  if (settings.moving && performance.now() - lastTiming > 1000) {
    measureTimes(query);
  } else {
    timingTimer = setTimeout(() => measureTimes(query), 150);
  }
}

function search(query) {
  const candidates = tree.query(query.area);
  const found = new Set();
  for (const entry of candidates) {
    if (query.exact(entry.value)) {
      found.add(entry.id);
    }
  }
  return { candidates, found };
}

function addShape(path, shape, px) {
  if (shape.kind === 'rectangle') {
    path.rect(shape.x, shape.y, Math.max(shape.width, px), Math.max(shape.height, px));
    return;
  }
  const radius = shape.kind === 'circle' ? Math.max(shape.radius, px) : 2 * px;
  path.moveTo(shape.x + radius, shape.y);
  path.arc(shape.x, shape.y, radius, 0, Math.PI * 2);
}

function addBox(path, b) {
  path.rect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
}

function paintBackground(scale, px) {
  if (background.width !== canvas.width || background.height !== canvas.height) {
    background.width = canvas.width;
    background.height = canvas.height;
  }
  const layer = background.getContext('2d');
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, background.width, background.height);
  layer.setTransform(scale, 0, 0, scale, 0, 0);

  const cells = new Path2D();
  const stack = tree.root ? [tree.root] : [];
  while (stack.length > 0) {
    const node = stack.pop();
    addBox(cells, node.cell);
    if (node.children) {
      stack.push(...node.children);
    }
  }
  layer.lineWidth = px;
  layer.strokeStyle = colors.cell;
  layer.stroke(cells);

  const paths = new Map([colors.object, colors.wall, colors.stuck].map((c) => [c, new Path2D()]));
  for (const o of objects) {
    const long = o.shape.width > 40 || o.shape.height > 40;
    const color = stuck.has(o.id) ? colors.stuck : long ? colors.wall : colors.object;
    addShape(paths.get(color), o.shape, px);
  }
  for (const [color, path] of paths) {
    layer.fillStyle = color;
    layer.fill(path);
  }
}

function draw() {
  const scale = canvas.width / WORLD.width;
  const px = 1 / scale;
  if (backgroundDirty) {
    stuck = stuckNearTop();
    paintBackground(scale, px);
    backgroundDirty = false;
  }
  const query = currentQuery();
  const result = search(query);
  const walked = walk(query.area);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(background, 0, 0);
  context.setTransform(scale, 0, 0, scale, 0, 0);

  if (query.half) {
    context.fillStyle = 'rgba(14, 124, 123, 0.06)';
    const t = query.target;
    const top = query.half === 'above' ? 0 : t.y + t.height;
    const bottom = query.half === 'above' ? t.y : WORLD.height;
    context.fillRect(0, top, WORLD.width, bottom - top);
  }

  const visited = new Path2D();
  const loose = new Path2D();
  for (const node of walked.visited) {
    addBox(visited, node.cell);
    addBox(loose, node.loose);
  }
  context.strokeStyle = colors.teal;
  context.lineWidth = 1.5 * px;
  context.stroke(visited);
  if (settings.showLoose && settings.tree === 'loose') {
    context.setLineDash([5 * px, 5 * px]);
    context.globalAlpha = 0.45;
    context.stroke(loose);
    context.setLineDash([]);
    context.globalAlpha = 1;
  }

  const found = new Path2D();
  const rejected = new Path2D();
  for (const entry of result.candidates) {
    if (result.found.has(entry.id)) {
      addShape(found, entry.value.shape, px);
    } else if (!query.half) {
      addBox(rejected, entry.bounds);
    }
  }
  context.fillStyle = colors.found;
  context.fill(found);
  context.strokeStyle = colors.found;
  context.lineWidth = 1.5 * px;
  context.stroke(rejected);

  const target = new Path2D();
  addShape(target, query.target, px);
  context.strokeStyle = colors.query;
  context.lineWidth = 2 * px;
  context.stroke(target);

  updateNumbers(query, result, walked);
}

function moveObjects(seconds) {
  for (const o of objects) {
    o.shape = { ...o.shape, x: o.shape.x + o.vx * seconds, y: o.shape.y + o.vy * seconds };
    const b = boundsOf(o.shape);
    if (b.minX < 0 || b.maxX > WORLD.width) o.vx = -o.vx;
    if (b.minY < 0 || b.maxY > WORLD.height) o.vy = -o.vy;
    tree.update(entryOf(o));
  }
}

let previous = performance.now();
function frame(now) {
  const seconds = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  if (settings.moving) {
    moveObjects(seconds);
    backgroundDirty = true;
    needsDraw = true;
  }
  if (needsDraw) {
    needsDraw = false;
    draw();
  }
  requestAnimationFrame(frame);
}

function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  backgroundDirty = true;
  needsDraw = true;
}

function followPointer(event) {
  const rect = canvas.getBoundingClientRect();
  mouse = {
    x: ((event.clientX - rect.left) / rect.width) * WORLD.width,
    y: ((event.clientY - rect.top) / rect.height) * WORLD.height,
  };
  needsDraw = true;
}
canvas.addEventListener('pointermove', followPointer);
canvas.addEventListener('pointerdown', followPointer);

function applySetting(name, value) {
  settings[name] = name === 'count' || name === 'size' ? Number(value) : value;
  if (name === 'count') {
    const moving = document.querySelector('[data-setting="moving"]');
    moving.disabled = settings.count > MOVING_LIMIT;
    if (moving.disabled) {
      moving.checked = false;
      settings.moving = false;
    }
  }
  if (['tree', 'count', 'layout'].includes(name)) {
    rebuild();
  }
  needsDraw = true;
}

for (const control of document.querySelectorAll('[data-setting]')) {
  const name = control.dataset.setting;
  if (control.type === 'checkbox') {
    control.addEventListener('change', () => applySetting(name, control.checked));
  } else if (control.tagName === 'SELECT' || control.type === 'range') {
    control.addEventListener('input', () => applySetting(name, control.value));
  } else {
    control.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) {
        return;
      }
      for (const other of control.querySelectorAll('button')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      applySetting(name, button.dataset.value);
    });
  }
}

rebuild();
new ResizeObserver(fitCanvas).observe(canvas);
fitCanvas();
requestAnimationFrame(frame);
