import { Vector3 } from 'three';
import { Component } from '../engine-entities/engine-entities-components';

export type ColliderShape = 'aabb';

export class ColliderComponent extends Component {
  static readonly type = 'collider';

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
}
