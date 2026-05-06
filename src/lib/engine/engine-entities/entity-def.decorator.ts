import { Entity } from './entity';

export type EntityDefOptions = {
  /**
   * Logical type name for the entity, used in serialization and filtering.
   * Defaults to the lowercase class name.
   *
   * @example 'player', 'npc', 'projectile'
   */
  type?: string;
};

/**
 * Registers metadata on an Entity subclass.
 *
 * @example
 * @EntityDef({ type: 'player' })
 * export class PlayerEntity extends Entity { ... }
 */
export function EntityDef(options: EntityDefOptions = {}): ClassDecorator {
  return (constructor) => {
    const type = options.type ?? constructor.name.toLowerCase();
    Reflect.defineMetadata('entity:type', type, constructor);
  };
}

/**
 * Returns the entity type registered via @EntityDef, or undefined if the
 * class was not decorated.
 */
export function GetEntityType(instance: object): string | undefined {
  return Reflect.getMetadata('entity:type', instance.constructor);
}
