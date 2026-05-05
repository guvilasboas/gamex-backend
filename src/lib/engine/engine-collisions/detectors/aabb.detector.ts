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
    const dz = posA.z - posB.z;

    const overlapX = halfA.x + halfB.x - Math.abs(dx);
    const overlapZ = halfA.z + halfB.z - Math.abs(dz);

    if (overlapX <= 0 || overlapZ <= 0) {
      return null;
    }

    let normal: Vector3;
    let depth: number;

    if (overlapX < overlapZ) {
      depth = overlapX;
      normal = new Vector3(dx < 0 ? 1 : -1, 0, 0);
    } else {
      depth = overlapZ;
      normal = new Vector3(0, 0, dz < 0 ? 1 : -1);
    }

    return {
      entityA,
      entityB,
      colliderA,
      colliderB,
      overlap: new Vector3(overlapX, 0, overlapZ),
      normal,
      depth,
    };
  }
}
