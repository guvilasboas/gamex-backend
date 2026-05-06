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

/**
 * Adds a collider component to an entity.
 * @param params - The parameters for the collider component.
 * @returns The created collider component.
 */
export function AddCollider(
  params: {
    id: string;
    entityId: string;
    size: Vector3;
  } & Partial<ColliderComponent>,
): ColliderComponent {
  return AttachComponent(params.entityId, ColliderComponent, params);
}

/**
 * Removes a collider component from an entity.
 *
 * @param entityId - The ID of the entity.
 * @param colliderId - The ID of the collider component.
 */
export function RemoveCollider(entityId: string, colliderId: string): void {
  RemoveComponent(entityId, colliderId);
}

/**
 * Retrieves all collider components attached to an entity.
 *
 * @param entityId - The ID of the entity.
 * @returns An array of ColliderComponent instances attached to the entity.
 */
export function GetColliders(entityId: string): ColliderComponent[] {
  return GetComponentsByType(entityId, ColliderComponent);
}

/**
 * Enables or disables a specific collider component on an entity.
 *
 * @param entityId - The ID of the entity.
 * @param colliderId - The ID of the collider component.
 * @param enabled - Whether to enable or disable the collider.
 */
export function SetColliderEnabled(
  entityId: string,
  colliderId: string,
  enabled: boolean,
): void {
  PatchComponent(entityId, colliderId, { enabled });
}

/**
 * Retrieves all active collisions for a specific entity.
 *
 * @param entityId - The ID of the entity.
 * @returns An array of CollisionManifold instances representing the active collisions.
 */
export function GetActiveCollisions(entityId: string): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  return registry.getByEntity(entityId);
}

/**
 * Retrieves all active collisions involving a specific collider component.
 *
 * @param entityId - The ID of the entity.
 * @param colliderId - The ID of the collider component.
 * @returns An array of CollisionManifold instances representing the active collisions for the collider.
 */
export function GetColliderCollisions(
  entityId: string,
  colliderId: string,
): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  return registry.getByCollider(entityId, colliderId);
}

/**
 * Checks if two colliders are currently colliding.
 *
 * @param entityAId - The ID of the first entity.
 * @param colliderAId - The ID of the first collider component.
 * @param entityBId - The ID of the second entity.
 * @param colliderBId - The ID of the second collider component.
 * @returns True if the colliders are colliding, false otherwise.
 */
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

/**
 * Checks if an entity would collide with any collidable entities at a given future position.
 * Useful for movement prediction and collision avoidance.
 *
 * @param entityId - The ID of the entity to check.
 * @param futurePosition - The future position to check for potential collisions.
 * @returns True if a collision would occur at the future position, false otherwise.
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

/**
 * Adds a collision filter between two tags, preventing collisions between entities with these tags.
 *
 * @param tagA - The first tag.
 * @param tagB - The second tag.
 */
export function AddCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  registry.addFilter({ tagA, tagB });
}

/**
 * Removes a collision filter between two tags, allowing collisions between entities with these tags.
 *
 * @param tagA - The first tag.
 * @param tagB - The second tag.
 */
export function RemoveCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(
    EngineCollisionsRegistry,
  );
  registry.removeFilter(tagA, tagB);
}
