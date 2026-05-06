import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_COLLISION_ENTER_EVENT,
  ENGINE_COLLISION_EXIT_EVENT,
  ENGINE_COLLISION_STAY_EVENT,
} from './engine-collisions.events';
import { CollisionManifold } from './engine-collisions.types';

export type CollisionEventFilter = {
  /** Match if any entity in the pair has this tag. */
  entityTag?: string;
  /** Match if any collider in the pair has this tag. */
  colliderTag?: string;
  /**
   * Which side of the collision pair to check.
   * - `'a'` — check only entityA / colliderA
   * - `'b'` — check only entityB / colliderB
   * - `'any'` (default) — accept if either side matches
   */
  side?: 'a' | 'b' | 'any';
};

function sideMatches(
  manifold: CollisionManifold,
  side: 'a' | 'b',
  filter: CollisionEventFilter,
): boolean {
  const entity = side === 'a' ? manifold.entityA : manifold.entityB;
  const collider = side === 'a' ? manifold.colliderA : manifold.colliderB;
  if (filter.entityTag && !entity.tags.includes(filter.entityTag)) return false;
  if (filter.colliderTag && !collider.tags.includes(filter.colliderTag))
    return false;
  return true;
}

function matchesCollisionFilter(
  manifold: CollisionManifold,
  filter: CollisionEventFilter,
): boolean {
  const side = filter.side ?? 'any';
  if (side === 'a') return sideMatches(manifold, 'a', filter);
  if (side === 'b') return sideMatches(manifold, 'b', filter);
  return (
    sideMatches(manifold, 'a', filter) || sideMatches(manifold, 'b', filter)
  );
}

function makeCollisionDecorator(eventName: string) {
  return (filter?: CollisionEventFilter): MethodDecorator =>
    (target, propertyKey, descriptor: PropertyDescriptor) => {
      if (filter) {
        const original = descriptor.value as (
          manifold: CollisionManifold,
        ) => unknown;
        descriptor.value = function (manifold: CollisionManifold) {
          if (!matchesCollisionFilter(manifold, filter)) return;
          return original.call(this, manifold);
        };
      }
      OnEvent(eventName)(target, propertyKey, descriptor);
    };
}

/**
 * Listens to ENGINE_COLLISION_ENTER_EVENT.
 * When a filter is provided the method is only invoked when the collision
 * pair satisfies all filter criteria.
 *
 * @example
 * @OnCollisionEnter({ colliderTag: 'hitbox' })
 * onHit(manifold: CollisionManifold): void { ... }
 */
export const OnCollisionEnter = makeCollisionDecorator(
  ENGINE_COLLISION_ENTER_EVENT,
);

/**
 * Listens to ENGINE_COLLISION_STAY_EVENT with optional filtering.
 */
export const OnCollisionStay = makeCollisionDecorator(
  ENGINE_COLLISION_STAY_EVENT,
);

/**
 * Listens to ENGINE_COLLISION_EXIT_EVENT with optional filtering.
 */
export const OnCollisionExit = makeCollisionDecorator(
  ENGINE_COLLISION_EXIT_EVENT,
);
