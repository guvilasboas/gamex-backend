import { Injectable } from '@nestjs/common';
import { Vector3 } from 'three';
import { Entity } from '../../engine-entities';
import { Collider } from '../collider';
import { CollisionManifold } from '../engine-collisions.types';
import { ICollisionDetector } from './collision-detector.interface';

@Injectable()
export class AabbDetector implements ICollisionDetector {
  detect(
    entityA: Entity,
    colliderA: Collider,
    entityB: Entity,
    colliderB: Collider,
  ): CollisionManifold | null {
    const posA = colliderA.getWorldPosition(entityA.position);
    const posB = colliderB.getWorldPosition(entityB.position);

    const halfA = colliderA.size.clone().multiplyScalar(0.5);
    const halfB = colliderB.size.clone().multiplyScalar(0.5);

    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;

    const overlapX = halfA.x + halfB.x - Math.abs(dx);
    const overlapY = halfA.y + halfB.y - Math.abs(dy);

    if (overlapX <= 0 || overlapY <= 0) {
      return null;
    }

    let normal: Vector3;
    let depth: number;

    if (overlapX < overlapY) {
      depth = overlapX;
      normal = new Vector3(dx < 0 ? 1 : -1, 0, 0);
    } else {
      depth = overlapY;
      normal = new Vector3(0, dy < 0 ? 1 : -1, 0);
    }

    return {
      entityA,
      entityB,
      colliderA,
      colliderB,
      overlap: new Vector3(overlapX, overlapY, 0),
      normal,
      depth,
    };
  }
}
