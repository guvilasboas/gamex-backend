import { Vector3 } from 'three';
import { Container } from '../../../common/container';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollisionsManager } from './engine-collisions.manager';
import { ColliderComponent } from './collider.component';
import {
  AttachComponent,
  GetComponentsByType,
  PatchComponent,
  RemoveComponent,
} from '../engine-entities/engine-entities-components';
import {
  CollisionManifold,
  createCollisionPairKey,
} from './engine-collisions.types';

// ─── Collider management ──────────────────────────────────────────────────────

export function AddCollider(
  params: {
    id: string;
    entityId: string;
    size: Vector3;
  } & Partial<ColliderComponent>,
): ColliderComponent {
  return AttachComponent(params.entityId, ColliderComponent, params as any);
}

export function RemoveCollider(entityId: string, colliderId: string): void {
  RemoveComponent(entityId, colliderId);
}

export function GetColliders(entityId: string): ColliderComponent[] {
  return GetComponentsByType(entityId, ColliderComponent);
}

export function SetColliderEnabled(
  entityId: string,
  colliderId: string,
  enabled: boolean,
): void {
  PatchComponent(entityId, colliderId, { enabled });
}

// ─── Collision queries ────────────────────────────────────────────────────────

export function GetActiveCollisions(entityId: string): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  return registry.getByEntity(entityId);
}

export function GetColliderCollisions(
  entityId: string,
  colliderId: string,
): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  return registry.getByCollider(entityId, colliderId);
}

export function AreCollidersColliding(
  entityAId: string,
  colliderAId: string,
  entityBId: string,
  colliderBId: string,
): boolean {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  return registry.has(
    createCollisionPairKey(entityAId, colliderAId, entityBId, colliderBId),
  );
}

// ─── Speculative collision check ─────────────────────────────────────────────

/**
 * Returns true if moving the entity to futurePosition would cause a collision
 * with any other collidable entity in the surrounding chunks.
 */
export function WouldCollideAt(
  entityId: string,
  futurePosition: Vector3,
): boolean {
  const manager = Container.get<EngineCollisionsManager>(
    EngineCollisionsManager,
  );
  return manager.wouldCollideAt(entityId, futurePosition);
}

// ─── Collision filters ────────────────────────────────────────────────────────

export function AddCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  registry.addFilter({ tagA, tagB });
}

export function RemoveCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  registry.removeFilter(tagA, tagB);
}
