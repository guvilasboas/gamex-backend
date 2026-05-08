import { Vector2, Vector3 } from 'three';
import { Sync } from '../../engine-decorators';
import { Entity } from '../entity';
import { instanceToPlain } from 'class-transformer';

export abstract class Component {
  static readonly type: string;

  /**
   * Unique identifier for this component instance within the entity.
   * Multiple components of the same type can coexist on an entity,
   * distinguished by their id.
   */
  id: string;

  /**
   * ID of the entity this component belongs to.
   * Set automatically by AddComponent.
   */
  entityId: string;

  /**
   * The size of the renderable component.
   *
   * This is used to determine the size of the sprite or animation when rendered. The default size is (1, 1, 0).
   *
   * @type {Vector3}
   */
  size = new Vector3(1, 1, 0);

  /**
   * The offset of the collider relative to the entity's position.
   *
   * @type {Vector3}
   */
  offset: Vector3 = new Vector3(0, 0, 0);

  /**
   * Whether the component is enabled.
   *
   * @type {boolean}
   */
  enabled: boolean = true;

  /**
   * Returns the canonical type key for this component instance.
   *
   * By default, this is the static `type` property on the class, or the class name if `type` is not defined.
   * This allows for consistent identification of component types at runtime, even after minification or obfuscation.
   * Override the static `type` property in subclasses to provide a custom type key if desired.
   *
   * @type {string}
   */
  @Sync()
  get type(): string {
    return (this.constructor as typeof Component).type ?? this.constructor.name;
  }

  /**
   * Optional method that can be overridden by subclasses to perform initialization logic when the component is added to an entity.
   *
   * @type {() => void}
   */
  set type(_: string) {
    // no-op: type is derived from the class and should not be set on instances
  }

  /**
   * Gets the size of the renderable component.
   *
   * @returns {Vector3} The size of the renderable component.
   */
  getSize() {
    return this.size;
  }

  /**
   * Sets the size of the renderable component.
   *
   * @param {Vector3} size - The new size of the renderable component.
   */
  setSize(size: Vector3) {
    this.size.copy(size);
  }

  /**
   * Gets the offset of the renderable component.
   *
   * @returns {Vector3} The offset of the renderable component.
   */
  getOffset() {
    return this.offset;
  }

  /**
   * Sets the offset of the renderable component.
   *
   * @param {Vector3} offset - The new offset of the renderable component.
   */
  setOffset(offset: Vector3) {
    this.offset.copy(offset);
  }

  /**
   * Gets the entity ID this component belongs to.
   *
   * @returns {string} The entity ID.
   */
  getEntityId() {
    return this.entityId;
  }

  /**
   * Sets the entity ID this component belongs to.
   *
   * @param {string} entityId - The new entity ID.
   */
  setEntityId(entityId: string) {
    this.entityId = entityId;
  }

  /**
   * Gets whether the component is enabled.
   *
   * @returns {boolean} True if the component is enabled, false otherwise.
   */
  getEnabled() {
    return this.enabled;
  }

  /**
   * Sets whether the component is enabled.
   *
   * @param {boolean} enabled - True to enable the component, false to disable it.
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
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

  /**
   * Get component index used for storing in the registry, based on entity ID and component ID.
   *
   * @returns {string} The component index in the format `${entityId}_${componentId}`.
   */
  getIndex() {
    return `${this.entityId}_${this.id}`;
  }

  /**
   * Serializes the component to a JSON-friendly format, including the world position of the collider.
   *
   * @param {Entity} entity - The entity this component belongs to, used to calculate the world position.
   * @returns {object} A JSON-serializable representation of the component.
   */
  getJson(entity: Entity) {
    return {
      ...instanceToPlain(this),
      position: instanceToPlain(this.getWorldPosition(entity.position)),
    };
  }
}
