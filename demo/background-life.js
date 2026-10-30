import { SpatialIndex } from './lib/index.js';

const CELL = 18;
const GENERATION_MS = 260;
const FADE_MS = 240;
const COLOR = '108, 99, 214';

const canvas = document.getElementById('life');
const context = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cells = new SpatialIndex();
const shown = new Map();
let columns = 0;
let rows = 0;
let running = !reduceMotion;
let lastGeneration = 0;
let lastFrame = 0;

const GLIDER_RIGHT = ['.#.', '..#', '###'];
const GLIDER_LEFT = ['.#.', '#..', '###'];

const keyOf = (x, y) => `${x},${y}`;

function setAlive(x, y) {
  const id = keyOf(x, y);
  if (!cells.has(id)) {
    cells.add(id, { x, y }, { minX: x, minY: y, maxX: x, maxY: y });
  }
}

function step() {
  const alive = cells.query({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 });
  const candidates = new Map();
  for (const { value } of alive) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        candidates.set(keyOf(value.x + dx, value.y + dy), [value.x + dx, value.y + dy]);
      }
    }
  }
  const births = [];
  const deaths = [];
  for (const [id, [x, y]] of candidates) {
    const around = cells.query({ minX: x - 1, minY: y - 1, maxX: x + 1, maxY: y + 1 });
    const isAlive = cells.has(id);
    const neighbours = around.length - (isAlive ? 1 : 0);
    if (isAlive && (neighbours < 2 || neighbours > 3)) deaths.push(id);
    if (!isAlive && neighbours === 3) births.push([x, y]);
  }
  for (const id of deaths) cells.remove(id);
  for (const [x, y] of births) setAlive(x, y);

  for (const { id, value } of alive) {
    if (value.x < -20 || value.y < -20 || value.x > columns + 20 || value.y > rows + 20) {
      cells.remove(id);
    }
  }
  if (cells.size < 60 || Math.random() < 0.04) {
    addGlider();
  }
}

function addGlider() {
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? 2 : columns - 5;
  const y = Math.floor(Math.random() * Math.max(1, rows - 5));
  const picture = fromLeft ? GLIDER_RIGHT : GLIDER_LEFT;
  picture.forEach((line, dy) =>
    [...line].forEach((c, dx) => c === '#' && setAlive(x + dx, y + dy)),
  );
}

function seed() {
  cells = new SpatialIndex();
  shown.clear();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const nearEdge = x < columns * 0.18 || x > columns * 0.82;
      if (nearEdge && Math.random() < 0.22) setAlive(x, y);
    }
  }
}

function draw(elapsed) {
  const ratio = window.devicePixelRatio || 1;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const change = elapsed / FADE_MS;
  for (const { id } of cells.query({ minX: -1, minY: -1, maxX: columns, maxY: rows })) {
    if (!shown.has(id)) shown.set(id, 0);
  }
  for (const [id, value] of shown) {
    const target = cells.has(id) ? 1 : 0;
    const next = target > value ? Math.min(1, value + change) : Math.max(0, value - change);
    if (next === 0 && target === 0) {
      shown.delete(id);
      continue;
    }
    shown.set(id, next);
    const [x, y] = id.split(',').map(Number);
    context.fillStyle = `rgba(${COLOR}, ${0.09 * next})`;
    context.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    context.strokeStyle = `rgba(${COLOR}, ${0.16 * next})`;
    context.strokeRect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3);
  }
}

function frame(now) {
  const elapsed = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  if (running && now - lastGeneration >= GENERATION_MS) {
    lastGeneration = now;
    step();
  }
  draw(elapsed);
  requestAnimationFrame(frame);
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  const firstTime = columns === 0;
  columns = Math.ceil(window.innerWidth / CELL);
  rows = Math.ceil(window.innerHeight / CELL);
  if (firstTime) seed();
}

const panel = document.getElementById('life-controls');
const button = (name) => panel.querySelector(`[data-life="${name}"]`);

function updatePanel() {
  button('play').disabled = running;
  button('pause').disabled = !running;
}

button('play').addEventListener('click', () => {
  running = true;
  updatePanel();
});
button('pause').addEventListener('click', () => {
  running = false;
  updatePanel();
});
button('step').addEventListener('click', () => {
  running = false;
  step();
  updatePanel();
});
button('close').addEventListener('click', () => {
  running = false;
  cells = new SpatialIndex();
  panel.hidden = true;
});
updatePanel();

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
