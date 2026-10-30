// Рыхлое (loose) квадродерево.
//
// Узел — квадратная ячейка; переполненная ячейка делится на четыре четверти.
// В отличие от обычного дерева, объект спускается в четверть (выбранную по его центру),
// если целиком помещается в её рыхлую область — ячейку, расширенную на looseness × сторону.
// Поэтому мелкие объекты на линиях раздела не застревают в верхних узлах.
// Все объекты поддерева лежат внутри его рыхлой области — на этом держится поиск.
// При looseness = 0 дерево ведёт себя как обычное.

import { contains, intersects } from './aabb.js';
import type { AABB } from './aabb.js';

/** value дерево не читает — только хранит. */
export interface Entry<T> {
  readonly id: string;
  readonly bounds: AABB;
  readonly value: T;
}

export interface Node<T> {
  readonly cell: AABB;
  /** Ячейка с запасом: внутри неё лежат все объекты этого узла и его потомков. */
  readonly loose: AABB;
  /** Нужна только для предохранителя MAX_DEPTH. */
  readonly depth: number;
  /** Объекты самого узла, без объектов детей. */
  readonly entries: Map<string, Entry<T>>;
  /** [левая верхняя, правая верхняя, левая нижняя, правая нижняя]. */
  children?: [Node<T>, Node<T>, Node<T>, Node<T>];
  /** Нужен, чтобы после удаления подняться вверх и склеить опустевшие узлы. */
  parent?: Node<T>;
}

/** Без предела стопка объектов в одной точке делила бы ячейку бесконечно. */
const MAX_DEPTH = 24;

export class Quadtree<T> {
  /** Появляется при первой вставке и растёт, если объект оказался за его пределами. */
  root: Node<T> | undefined;

  /** id → узел объекта, чтобы удаление не искало объект по дереву. */
  private readonly owners = new Map<string, Node<T>>();

  /**
   * @param capacity сколько объектов узел держит, прежде чем делиться
   * @param looseness запас рыхлой области в долях стороны ячейки (0 — обычное дерево)
   */
  constructor(
    readonly capacity = 8,
    readonly looseness = 0.25,
  ) {}

  get size(): number {
    return this.owners.size;
  }

  has(id: string): boolean {
    return this.owners.has(id);
  }

  get(id: string): Entry<T> | undefined {
    return this.owners.get(id)?.entries.get(id);
  }

  insert(entry: Entry<T>): void {
    this.growRootToFit(entry.bounds);
    const node = this.findNodeFor(entry.bounds);
    node.entries.set(entry.id, entry);
    this.owners.set(entry.id, node);
    this.splitIfNeeded(node);
  }

  remove(id: string): boolean {
    const node = this.owners.get(id);
    if (!node) {
      return false;
    }
    node.entries.delete(id);
    this.owners.delete(id);
    this.mergeIfSparse(node.children ? node : node.parent);
    return true;
  }

  /**
   * Перемещение — это удаление и вставка. Рост корня (единственное, что может
   * бросить ошибку) делается заранее, чтобы при ошибке старая запись осталась на месте.
   */
  update(entry: Entry<T>): void {
    this.growRootToFit(entry.bounds);
    this.remove(entry.id);
    this.insert(entry);
  }

  /** Порядок результата не гарантируется. */
  query(area: AABB): Entry<T>[] {
    const found: Entry<T>[] = [];
    const stack = this.root ? [this.root] : [];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (!intersects(node.loose, area)) {
        // За пределами рыхлой области в поддереве ничего нет.
        continue;
      }
      if (contains(area, node.loose)) {
        // Запрос накрыл всё поддерево: подходит каждый объект, проверять не нужно.
        collectAll(node, found);
        continue;
      }
      for (const entry of node.entries.values()) {
        if (intersects(entry.bounds, area)) {
          found.push(entry);
        }
      }
      if (node.children) {
        stack.push(...node.children);
      }
    }
    return found;
  }

  clear(): void {
    this.root = undefined;
    this.owners.clear();
  }

  private makeNode(cell: AABB, depth: number, parent?: Node<T>): Node<T> {
    const margin = (cell.maxX - cell.minX) * this.looseness;
    const loose = {
      minX: cell.minX - margin,
      minY: cell.minY - margin,
      maxX: cell.maxX + margin,
      maxY: cell.maxY + margin,
    };
    return { cell, loose, depth, entries: new Map(), parent };
  }

  /**
   * Если объект не помещается в корень, корень удваивается в его сторону,
   * а старый корень целиком становится одной из четвертей нового.
   * Объекты при этом не переносятся — меняется только верх дерева.
   */
  private growRootToFit(bounds: AABB): void {
    if (!this.root) {
      this.root = this.makeNode(firstCell(bounds), 0);
      return;
    }
    while (!contains(this.root.cell, bounds)) {
      const old = this.root;
      const side = old.cell.maxX - old.cell.minX;
      const toLeft = bounds.minX < old.cell.minX;
      const toTop = bounds.minY < old.cell.minY;
      const minX = toLeft ? old.cell.minX - side : old.cell.minX;
      const minY = toTop ? old.cell.minY - side : old.cell.minY;
      const cell = { minX, minY, maxX: minX + 2 * side, maxY: minY + 2 * side };
      if (!Number.isFinite(cell.minX + cell.maxX + cell.minY + cell.maxY)) {
        throw new RangeError('Object is too far away: the tree root cannot grow to reach it');
      }
      const root = this.makeNode(cell, old.depth - 1);
      const children = quarters(cell).map((quarter) => this.makeNode(quarter, old.depth, root));
      // Старый корень занимает ту четверть нового, которая дальше от объекта.
      children[(toTop ? 2 : 0) + (toLeft ? 1 : 0)] = old;
      old.parent = root;
      root.children = children as Node<T>['children'];
      this.root = root;
    }
  }

  private findNodeFor(bounds: AABB): Node<T> {
    let node = this.root!;
    for (let child = childFor(node, bounds); child; child = childFor(node, bounds)) {
      node = child;
    }
    return node;
  }

  private splitIfNeeded(node: Node<T>): void {
    if (node.children || node.entries.size <= this.capacity || node.depth >= MAX_DEPTH) {
      return;
    }
    node.children = quarters(node.cell).map((quarter) =>
      this.makeNode(quarter, node.depth + 1, node),
    ) as Node<T>['children'];

    for (const entry of node.entries.values()) {
      const child = childFor(node, entry.bounds);
      if (child) {
        node.entries.delete(entry.id);
        child.entries.set(entry.id, entry);
        this.owners.set(entry.id, child);
      }
    }
    // Если почти всё упало в одну четверть, она тоже может оказаться переполненной.
    for (const child of node.children!) {
      this.splitIfNeeded(child);
    }
  }

  /**
   * Обратное делению: если дети — листья и вместе с узлом в них не больше capacity / 2
   * объектов, дети убираются, объекты поднимаются в узел; затем проверяется родитель.
   *
   * Без этого движущиеся объекты оставляли бы за собой пустые узлы.
   * Порог вдвое ниже capacity, чтобы узел не делился и не склеивался туда-обратно.
   */
  private mergeIfSparse(start: Node<T> | undefined): void {
    for (let node = start; node?.children; node = node.parent) {
      if (node.children.some((child) => child.children)) {
        return;
      }
      let total = node.entries.size;
      for (const child of node.children) {
        total += child.entries.size;
      }
      if (total > this.capacity / 2) {
        return;
      }
      // Объекты ребёнка лежат в его рыхлой области, а она внутри рыхлой области родителя.
      for (const child of node.children) {
        for (const entry of child.entries.values()) {
          node.entries.set(entry.id, entry);
          this.owners.set(entry.id, node);
        }
      }
      node.children = undefined;
    }
  }
}

/**
 * Первый корень: квадрат от целой точки у угла объекта со стороной 1, 2, 4, 8…
 *
 * Угол берётся от объекта, а не от сетки: на сетке объект от −1 до 1
 * не поместился бы ни в один квадрат — край каждого лежал бы на нуле.
 */
function firstCell(bounds: AABB): AABB {
  const minX = Math.floor(bounds.minX);
  const minY = Math.floor(bounds.minY);
  for (let side = 1; Number.isFinite(minX + side) && Number.isFinite(minY + side); side *= 2) {
    const cell = { minX, minY, maxX: minX + side, maxY: minY + side };
    if (contains(cell, bounds)) {
      return cell;
    }
  }
  throw new RangeError('Object is too large for the tree root');
}

function quarters(cell: AABB): AABB[] {
  const midX = (cell.minX + cell.maxX) / 2;
  const midY = (cell.minY + cell.maxY) / 2;
  return [
    { minX: cell.minX, minY: cell.minY, maxX: midX, maxY: midY },
    { minX: midX, minY: cell.minY, maxX: cell.maxX, maxY: midY },
    { minX: cell.minX, minY: midY, maxX: midX, maxY: cell.maxY },
    { minX: midX, minY: midY, maxX: cell.maxX, maxY: cell.maxY },
  ];
}

/** Четверть, куда можно спустить объект, или undefined, если он остаётся в узле. */
function childFor<T>(node: Node<T>, bounds: AABB): Node<T> | undefined {
  if (!node.children) {
    return undefined;
  }
  const midX = (node.cell.minX + node.cell.maxX) / 2;
  const midY = (node.cell.minY + node.cell.maxY) / 2;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const child = node.children[(centerY < midY ? 0 : 2) + (centerX < midX ? 0 : 1)];
  return contains(child.loose, bounds) ? child : undefined;
}

function collectAll<T>(start: Node<T>, found: Entry<T>[]): void {
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const entry of node.entries.values()) {
      found.push(entry);
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
}
