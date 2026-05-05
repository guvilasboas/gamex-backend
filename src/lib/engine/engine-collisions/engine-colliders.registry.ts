import { Injectable } from '@nestjs/common';
import { Collider } from './collider';

@Injectable()
export class EngineCollidersRegistry {
  private readonly colliders: Map<string, Collider[]> = new Map();

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

  removeAll(entityId: string): void {
    this.colliders.delete(entityId);
  }

  getByEntity(entityId: string): Collider[] {
    return this.colliders.get(entityId) ?? [];
  }

  getAll(): Collider[] {
    return Array.from(this.colliders.values()).flat();
  }
}
