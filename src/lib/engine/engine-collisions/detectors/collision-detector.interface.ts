import { Entity } from '../../engine-entities';
import { ColliderComponent } from '../collider.component';
import { CollisionManifold } from '../engine-collisions.types';

export interface ICollisionDetector {
  detect(
    entityA: Entity,
    colliderA: ColliderComponent,
    entityB: Entity,
    colliderB: ColliderComponent,
  ): CollisionManifold | null;
}
