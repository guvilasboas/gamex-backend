import { Vector3 } from 'three';

export type ColliderShape = 'aabb';

export class Collider {
  id: string;
  entityId: string;
  offset: Vector3 = new Vector3(0, 0, 0);
  size: Vector3;
  shape: ColliderShape = 'aabb';
  tags: string[] = [];
  enabled: boolean = true;

  constructor(
    params: Partial<Collider> & { id: string; entityId: string; size: Vector3 },
  ) {
    Object.assign(this, params);
  }

  getWorldPosition(entityPosition: Vector3): Vector3 {
    return entityPosition.clone().add(this.offset);
  }
}
