import { Expose } from 'class-transformer';

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
   * Returns the canonical type key for this component instance.
   *
   * By default, this is the static `type` property on the class, or the class name if `type` is not defined.
   * This allows for consistent identification of component types at runtime, even after minification or obfuscation.
   * Override the static `type` property in subclasses to provide a custom type key if desired.
   *
   * @type {string}
   */
  @Expose()
  get type(): string {
    return (this.constructor as typeof Component).type ?? this.constructor.name;
  }

  /**
   * Optional method that can be overridden by subclasses to perform initialization logic when the component is added to an entity.
   *
   * @type {() => void}
   */
  set type(value: string) {
    // no-op: type is derived from the class and should not be set on instances
  }
}
