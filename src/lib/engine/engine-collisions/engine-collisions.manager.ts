import { Inject, Injectable } from '@nestjs/common';
import { Vector3 } from 'three';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineEntitiesRegistry, Entity } from '../engine-entities';
import { EngineChunksRegistry } from '../engine-chunks';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineEntitiesComponentsManager } from '../engine-entities/engine-entities-components';
import { AabbDetector } from './detectors/aabb.detector';
import {
  ENGINE_COLLISION_ENTER_EVENT,
  ENGINE_COLLISION_EXIT_EVENT,
  ENGINE_COLLISION_STAY_EVENT,
} from './engine-collisions.events';
import {
  CollisionPairKey,
  createCollisionPairKey,
} from './engine-collisions.types';
import { ColliderComponent } from './collider.component';

export type CollisionExitPayload = {
  entityAId: string;
  colliderAId: string;
  entityBId: string;
  colliderBId: string;
};

@Injectable()
export class EngineCollisionsManager {
  constructor(
    @Inject(EngineEntitiesRegistry)
    private readonly entitiesRegistry: EngineEntitiesRegistry,
    @Inject(EngineChunksRegistry)
    private readonly chunksRegistry: EngineChunksRegistry,
    @Inject(EngineCollisionsRegistry)
    private readonly collisionsRegistry: EngineCollisionsRegistry,
    @Inject(EngineEntitiesComponentsManager)
    private readonly componentsManager: EngineEntitiesComponentsManager,
    @Inject(AabbDetector)
    private readonly detector: AabbDetector,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  detectAndEmit(): void {
    const currentFrameKeys = new Set<CollisionPairKey>();

    for (const [entityA, entityB] of this.broadPhase()) {
      const collidersA = this.componentsManager
        .getByType(entityA.id, ColliderComponent)
        .filter((c) => c.enabled);
      const collidersB = this.componentsManager
        .getByType(entityB.id, ColliderComponent)
        .filter((c) => c.enabled);

      if (collidersA.length === 0 || collidersB.length === 0) {
        continue;
      }

      for (const colliderA of collidersA) {
        for (const colliderB of collidersB) {
          if (!this.colliderPassesFilter(colliderA, colliderB)) {
            continue;
          }

          const manifold = this.detector.detect(
            entityA,
            colliderA,
            entityB,
            colliderB,
          );
          if (!manifold) {
            continue;
          }

          const key = createCollisionPairKey(
            entityA.id,
            colliderA.id,
            entityB.id,
            colliderB.id,
          );
          currentFrameKeys.add(key);

          if (this.collisionsRegistry.has(key)) {
            this.collisionsRegistry.add(key, manifold);
            this.eventEmitter.emit(ENGINE_COLLISION_STAY_EVENT, manifold);
          } else {
            this.collisionsRegistry.add(key, manifold);
            this.eventEmitter.emit(ENGINE_COLLISION_ENTER_EVENT, manifold);
          }
        }
      }
    }

    for (const existingKey of this.collisionsRegistry.getAllKeys()) {
      if (!currentFrameKeys.has(existingKey)) {
        const [sideA, sideB] = existingKey.split('::');
        const [entityAId, colliderAId] = sideA.split(':');
        const [entityBId, colliderBId] = sideB.split(':');
        this.collisionsRegistry.remove(existingKey);
        this.eventEmitter.emit(ENGINE_COLLISION_EXIT_EVENT, {
          entityAId,
          colliderAId,
          entityBId,
          colliderBId,
        } satisfies CollisionExitPayload);
      }
    }
  }

  /**
   * Checks if an entity would collide with any collidable entities at a given future position.
   * Useful for movement prediction and collision avoidance.
   */
  wouldCollideAt(entityId: string, futurePosition: Vector3): boolean {
    const entity = this.entitiesRegistry.get(entityId);
    if (!entity) return false;

    const collidersA = this.componentsManager
      .getByType(entityId, ColliderComponent)
      .filter((c) => c.enabled);
    if (collidersA.length === 0) return false;

    const chunk = this.chunksRegistry.get(entity.chunkId);
    if (!chunk) return false;

    const entityIds = new Set([
      ...Array.from(chunk.entities),
      ...this.getNeighboringEntityIds(chunk.neighboringChunkIds),
    ]);

    const candidates = Array.from(entityIds)
      .filter((id) => id !== entityId)
      .map((id) => this.entitiesRegistry.get(id))
      .filter((e): e is Entity => e !== undefined);

    // Simulate the entity at its future position without mutating the real object
    const futureEntity = { ...entity, position: futurePosition } as Entity;

    for (const entityB of candidates) {
      const collidersB = this.componentsManager
        .getByType(entityB.id, ColliderComponent)
        .filter((c) => c.enabled);
      if (collidersB.length === 0) continue;

      for (const colliderA of collidersA) {
        for (const colliderB of collidersB) {
          if (!this.colliderPassesFilter(colliderA, colliderB)) continue;
          if (
            this.detector.detect(futureEntity, colliderA, entityB, colliderB)
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private broadPhase(): [Entity, Entity][] {
    const checkedEntityPairs = new Set<string>();
    const pairs: [Entity, Entity][] = [];

    for (const chunk of this.chunksRegistry.getAll()) {
      const entityIds = new Set([
        ...Array.from(chunk.entities),
        ...this.getNeighboringEntityIds(chunk.neighboringChunkIds),
      ]);

      const entities = Array.from(entityIds)
        .map((id) => this.entitiesRegistry.get(id))
        .filter((e): e is Entity => e !== undefined);

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const pairKey = [entities[i].id, entities[j].id].sort().join('::');
          if (!checkedEntityPairs.has(pairKey)) {
            checkedEntityPairs.add(pairKey);
            pairs.push([entities[i], entities[j]]);
          }
        }
      }
    }

    return pairs;
  }

  private colliderPassesFilter(
    colliderA: ColliderComponent,
    colliderB: ColliderComponent,
  ): boolean {
    if (!this.collisionsRegistry.hasFilters()) {
      return true;
    }

    return this.collisionsRegistry.filters.some(
      (f) =>
        (colliderA.tags.includes(f.tagA) && colliderB.tags.includes(f.tagB)) ||
        (colliderA.tags.includes(f.tagB) && colliderB.tags.includes(f.tagA)),
    );
  }

  private getNeighboringEntityIds(neighboringChunkIds: string[]): string[] {
    return neighboringChunkIds.flatMap((chunkId) => {
      const chunk = this.chunksRegistry.get(chunkId);
      return chunk ? Array.from(chunk.entities) : [];
    });
  }
}
