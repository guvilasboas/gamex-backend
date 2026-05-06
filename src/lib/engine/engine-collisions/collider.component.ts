import { Vector3 } from 'three';
import { Component } from '../engine-entities/engine-entities-components';

export type ColliderShape = 'aabb';

export class ColliderComponent extends Component {
  static readonly type = 'collider';

  offset: Vector3 = new Vector3(0, 0, 0);
  size: Vector3;
  shape: ColliderShape = 'aabb';
  tags: string[] = [];
  enabled: boolean = true;

  constructor(
    params: Partial<ColliderComponent> & {
      id: string;
      entityId: string;
      size: Vector3;
    },
  ) {
    super({ id: params.id });
    Object.assign(this, params);
  }

  getWorldPosition(entityPosition: Vector3): Vector3 {
    return entityPosition.clone().add(this.offset);
  }
}
