import { Injectable } from '@nestjs/common';
import {
  CollisionFilter,
  CollisionManifold,
  CollisionPairKey,
} from './engine-collisions.types';

@Injectable()
export class EngineCollisionsRegistry {
  readonly activeCollisions: Map<CollisionPairKey, CollisionManifold> =
    new Map();

  readonly filters: CollisionFilter[] = [];

  add(key: CollisionPairKey, manifold: CollisionManifold): void {
    this.activeCollisions.set(key, manifold);
  }

  remove(key: CollisionPairKey): void {
    this.activeCollisions.delete(key);
  }

  has(key: CollisionPairKey): boolean {
    return this.activeCollisions.has(key);
  }

  get(key: CollisionPairKey): CollisionManifold | undefined {
    return this.activeCollisions.get(key);
  }

  getAll(): CollisionManifold[] {
    return Array.from(this.activeCollisions.values());
  }

  getAllKeys(): CollisionPairKey[] {
    return Array.from(this.activeCollisions.keys());
  }

  getByEntity(entityId: string): CollisionManifold[] {
    return this.getAll().filter(
      (m) => m.entityA.id === entityId || m.entityB.id === entityId,
    );
  }

  getByCollider(entityId: string, colliderId: string): CollisionManifold[] {
    return this.getAll().filter(
      (m) =>
        (m.entityA.id === entityId && m.colliderA.id === colliderId) ||
        (m.entityB.id === entityId && m.colliderB.id === colliderId),
    );
  }

  addFilter(filter: CollisionFilter): void {
    const already = this.filters.some(
      (f) =>
        (f.tagA === filter.tagA && f.tagB === filter.tagB) ||
        (f.tagA === filter.tagB && f.tagB === filter.tagA),
    );
    if (!already) {
      this.filters.push(filter);
    }
  }

  removeFilter(tagA: string, tagB: string): void {
    const index = this.filters.findIndex(
      (f) =>
        (f.tagA === tagA && f.tagB === tagB) ||
        (f.tagA === tagB && f.tagB === tagA),
    );
    if (index !== -1) {
      this.filters.splice(index, 1);
    }
  }

  hasFilters(): boolean {
    return this.filters.length > 0;
  }
}
