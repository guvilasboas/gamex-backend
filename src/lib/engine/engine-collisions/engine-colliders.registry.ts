import { Injectable } from '@nestjs/common';
import { Collider } from './collider';

@Injectable()
export class EngineCollidersRegistry {
  /**
   * A map of entity IDs to their colliders.
   *
   *
   * @type {colliders: Map<string, Collider[]>}
   */
  private readonly colliders: Map<string, Collider[]> = new Map();

  /**
   * Adds a collider to the registry.
   * If a collider with the same ID already exists for the entity, it will be replaced.
   *
   * @param {Collider} collider The collider to add.
   */
  add(collider: Collider): void {
    const list = this.colliders.get(collider.entityId) ?? [];
    const index = list.findIndex((c) => c.id === collider.id);

    if (index !== -1) {
      list[index] = collider;
    } else {
      list.push(collider);
    }

    this.colliders.set(collider.entityId, list);
  }

  /**
   * Removes a collider from the registry.
   *
   * @param {string} entityId The ID of the entity.
   * @param {string} colliderId The ID of the collider to remove.
   */
  remove(entityId: string, colliderId: string): void {
    const list = this.colliders.get(entityId);
    if (!list) return;
    const filtered = list.filter((c) => c.id !== colliderId);
    if (filtered.length === 0) {
      this.colliders.delete(entityId);
    } else {
      this.colliders.set(entityId, filtered);
    }
  }

  /**
   * Removes all colliders for a given entity.
   *
   * @param {string} entityId The ID of the entity.
   */
  removeAll(entityId: string): void {
    this.colliders.delete(entityId);
  }

  /**
   * Gets all colliders for a given entity.
   *
   * @param {string} entityId The ID of the entity.
   * @returns {Collider[]} The colliders for the entity.
   */
  getByEntity(entityId: string): Collider[] {
    return this.colliders.get(entityId) ?? [];
  }

  /**
   * Gets all colliders in the registry.
   *
   * @returns {Collider[]} All colliders in the registry.
   */
  getAll(): Collider[] {
    return Array.from(this.colliders.values()).flat();
  }
}
