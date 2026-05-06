import { Vector3 } from 'three';
import { Component } from '../engine-entities/engine-entities-components';

export type ColliderShape = 'aabb';

export class ColliderComponent extends Component {
  static readonly type = 'collider';

  /**
   * The offset of the collider relative to the entity's position.
   *
   * @type {Vector3}
   */
  offset: Vector3 = new Vector3(0, 0, 0);

  /**
   * The size of the collider.
   *
   * @type {Vector3}
   */
  size: Vector3;

  /**
   * The shape of the collider.
   *
   * @type {ColliderShape}
   */
  shape: ColliderShape = 'aabb';

  /**
   * Tags associated with the collider for collision filtering.
   *
   * @type {string[]}
   */
  tags: string[] = [];

  /**
   * Whether the collider is enabled.
   *
   * @type {boolean}
   */
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

  /**
   * Computes the world position of the collider based on the entity's position and the collider's offset.
   *
   * @param {Vector3} entityPosition - The world position of the entity.
   * @returns {Vector3} The world position of the collider.
   */
  getWorldPosition(entityPosition: Vector3): Vector3 {
    return entityPosition.clone().add(this.offset);
  }
}
