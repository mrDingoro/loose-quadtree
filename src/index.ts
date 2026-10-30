// Всё, что библиотека показывает наружу.

export { intersects, contains } from './aabb.js';
export type { AABB } from './aabb.js';

export { rectangle, circle, point, boundsOf } from './shapes.js';
export type { Shape, Rectangle, Circle, Point, Vec2 } from './shapes.js';

export { shapesIntersect, distanceToPoint } from './geometry.js';

export { SpatialIndex } from './spatial-index.js';
export type { SpatialIndexOptions } from './spatial-index.js';
export type { Entry } from './quadtree.js';

export { SpatialSpace } from './spatial-space.js';
export type { SpatialObject } from './spatial-space.js';
