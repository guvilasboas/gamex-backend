import { Vector3 } from 'three';
import { Entity } from '../engine-entities';
import { ColliderComponent } from './collider.component';

export type CollisionPairKey = string;

export const createCollisionPairKey = (
  entityAId: string,
  colliderAId: string,
  entityBId: string,
  colliderBId: string,
): CollisionPairKey => {
  const sideA = `${entityAId}:${colliderAId}`;
  const sideB = `${entityBId}:${colliderBId}`;
  return [sideA, sideB].sort().join('::');
};

export type CollisionManifold = {
  entityA: Entity;
  entityB: Entity;
  colliderA: ColliderComponent;
  colliderB: ColliderComponent;
  overlap: Vector3;
  normal: Vector3;
  depth: number;
};

export type CollisionFilter = {
  tagA: string;
  tagB: string;
};
