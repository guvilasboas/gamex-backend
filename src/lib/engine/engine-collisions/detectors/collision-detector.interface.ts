import { Entity } from '../../engine-entities';
import { Collider } from '../collider';
import { CollisionManifold } from '../engine-collisions.types';

export interface ICollisionDetector {
  detect(
    entityA: Entity,
    colliderA: Collider,
    entityB: Entity,
    colliderB: Collider,
  ): CollisionManifold | null;
}
