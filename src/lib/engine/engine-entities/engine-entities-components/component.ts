export abstract class Component {
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
   * Canonical type key for serialization and logging.
   * Defaults to the class name. Override in subclasses:
   *   static readonly type = 'health';
   */
  static readonly type: string;

  get type(): string {
    return (this.constructor as typeof Component).type ?? this.constructor.name;
  }

  constructor(params: Partial<Component> & { id: string }) {
    Object.assign(this, params);
  }
}
