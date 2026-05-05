import { Vector3 } from 'three';
import { Container } from '../../../common/container';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollidersRegistry } from './engine-colliders.registry';
import { Collider } from './collider';
import {
  CollisionManifold,
  createCollisionPairKey,
} from './engine-collisions.types';

// ─── Collider management ──────────────────────────────────────────────────────

export function AddCollider(
  params: { id: string; entityId: string; size: Vector3 } & Partial<Collider>,
): Collider {
  const registry = Container.get<EngineCollidersRegistry>(
    EngineCollidersRegistry,
  );
  const collider = new Collider(params);
  registry.add(collider);
  return collider;
}

export function RemoveCollider(entityId: string, colliderId: string): void {
  const registry = Container.get<EngineCollidersRegistry>(
    EngineCollidersRegistry,
  );
  registry.remove(entityId, colliderId);
}

export function GetColliders(entityId: string): Collider[] {
  const registry = Container.get<EngineCollidersRegistry>(
    EngineCollidersRegistry,
  );
  return registry.getByEntity(entityId);
}

export function SetColliderEnabled(
  entityId: string,
  colliderId: string,
  enabled: boolean,
): void {
  const registry = Container.get<EngineCollidersRegistry>(
    EngineCollidersRegistry,
  );
  const collider = registry
    .getByEntity(entityId)
    .find((c) => c.id === colliderId);
  if (collider) {
    collider.enabled = enabled;
  }
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
