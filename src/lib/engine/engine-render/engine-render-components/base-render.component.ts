import { Vector2, Vector3 } from 'three';
import { Component } from '../../engine-entities/engine-entities-components';

export class BaseRenderComponent extends Component {
  /**
   * The size of the renderable component.
   *
   * This is used to determine the size of the sprite or animation when rendered. The default size is (1, 1).
   *
   * @type {Vector2}
   */
  size = new Vector2(1, 1);

  /**
   * The position of the renderable component.
   *
   * This is used to determine the position of the sprite or animation when rendered. The default position is (0, 0, 0).
   *
   * @type {Vector3}
   */
  position = new Vector3(0, 0, 0);

  /**
   * Gets the size of the renderable component.
   *
   * @returns {Vector2} The size of the renderable component.
   */
  getSize() {
    return this.size;
  }

  /**
   * Sets the size of the renderable component.
   *
   * @param {Vector2} size - The new size of the renderable component.
   */
  setSize(size: Vector2) {
    this.size.copy(size);
  }

  /**
   * Gets the position of the renderable component.
   *
   * @returns {Vector3} The position of the renderable component.
   */
  getPosition() {
    return this.position;
  }

  /**
   * Sets the position of the renderable component.
   *
   * @param {Vector3} position - The new position of the renderable component.
   */
  setPosition(position: Vector3) {
    this.position.copy(position);
  }
}
