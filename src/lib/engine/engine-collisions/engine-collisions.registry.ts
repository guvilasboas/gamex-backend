import { Injectable } from '@nestjs/common';
import {
  CollisionFilter,
  CollisionManifold,
  CollisionPairKey,
} from './engine-collisions.types';

@Injectable()
export class EngineCollisionsRegistry {
  /**
   * A map that holds active collision manifolds, where the key is a unique identifier for a pair of colliding entities and their colliders, and the value is the corresponding collision manifold containing details about the collision.
   *
   * @type {Map<CollisionPairKey, CollisionManifold>} A map of active collisions, where each key is a CollisionPairKey (a string that uniquely identifies a pair of colliding entities and their colliders) and each value is a CollisionManifold (an object containing details about the collision, such as contact points, penetration depth, etc.).
   */
  readonly activeCollisions: Map<CollisionPairKey, CollisionManifold> =
    new Map();

  /**
   * A list of collision filters that define which collisions should be ignored based on tags.
   *
   * @type {CollisionFilter[]} An array of collision filters, where each filter specifies two tags (tagA and tagB). If a collision occurs between entities with colliders that have these tags, the collision will be ignored.
   */
  readonly filters: CollisionFilter[] = [];

  /**
   * Adds a collision manifold for a given key.
   *
   * @param key - The collision pair key.
   * @param manifold - The collision manifold to add.
   */
  add(key: CollisionPairKey, manifold: CollisionManifold): void {
    this.activeCollisions.set(key, manifold);
  }

  /**
   * Removes a collision manifold by its key.
   *
   * @param key - The collision pair key.
   */
  remove(key: CollisionPairKey): void {
    this.activeCollisions.delete(key);
  }

  /**
   * Checks if a collision manifold exists for the given key.
   *
   * @param key - The collision pair key.
   * @returns True if a collision manifold exists for the key, false otherwise.
   */
  has(key: CollisionPairKey): boolean {
    return this.activeCollisions.has(key);
  }

  /**
   * Retrieves a collision manifold by its key.
   *
   * @param key - The collision pair key.
   * @returns The collision manifold associated with the key, or undefined if not found.
   */
  get(key: CollisionPairKey): CollisionManifold | undefined {
    return this.activeCollisions.get(key);
  }

  /**
   * Retrieves all collision manifolds.
   *
   * @returns An array of all collision manifolds.
   */
  getAll(): CollisionManifold[] {
    return Array.from(this.activeCollisions.values());
  }

  /**
   * Retrieves all collision pair keys.
   *
   * @returns An array of all collision pair keys.
   */
  getAllKeys(): CollisionPairKey[] {
    return Array.from(this.activeCollisions.keys());
  }

  /**
   * Retrieves all collision manifolds involving a specific entity.
   *
   * @param entityId - The ID of the entity.
   * @returns An array of collision manifolds involving the specified entity.
   */
  getByEntity(entityId: string): CollisionManifold[] {
    return this.getAll().filter(
      (m) => m.entityA.id === entityId || m.entityB.id === entityId,
    );
  }

  /**
   * Retrieves all collision manifolds involving a specific collider of an entity.
   *
   * @param entityId - The ID of the entity.
   * @param colliderId - The ID of the collider.
   * @returns An array of collision manifolds involving the specified collider.
   */
  getByCollider(entityId: string, colliderId: string): CollisionManifold[] {
    return this.getAll().filter(
      (m) =>
        (m.entityA.id === entityId && m.colliderA.id === colliderId) ||
        (m.entityB.id === entityId && m.colliderB.id === colliderId),
    );
  }

  /**
   * Adds a collision filter if it doesn't already exist.
   *
   * @param filter - The collision filter to add.
   */
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

  /**
   * Removes a collision filter matching the given tags, if it exists.
   *
   * @param tagA - The first tag of the filter to remove.
   * @param tagB - The second tag of the filter to remove.
   */
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

  /**
   * Checks if there are any collision filters registered.
   *
   * @returns {boolean} True if there is at least one collision filter, false otherwise.
   */
  hasFilters(): boolean {
    return this.filters.length > 0;
  }
}
