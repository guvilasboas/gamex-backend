import { Entity } from './entity';
import { Component } from './engine-entities-components/component';

export type WithComponentInit<
  TEntity extends Entity,
  TComp extends Component,
> = Partial<TComp> | ((entity: TEntity) => Partial<TComp>);

export type WithComponentDef = {
  componentClass: new (...args: any[]) => Component;
  init: WithComponentInit<any, any>;
};

const ENTITY_COMPONENTS_KEY = 'entity:components';

/**
 * Declares that when an entity of this class is created via `CreateEntity`,
 * the given component should be automatically attached to it.
 *
 * Multiple `@WithComponent` decorators can be stacked on the same class.
 * The `init` argument can be a plain object or a factory function that
 * receives the entity instance (useful when params depend on entity state).
 *
 * @example
 * @EntityDef({ type: 'player' })
 * @WithComponent(ColliderComponent, { id: 'body', size: new Vector3(1, 1, 0) })
 * @WithComponent(HealthComponent, (entity: PlayerEntity) => ({ id: 'health', maxHp: entity.maxHp }))
 * export class PlayerEntity extends Entity { maxHp = 100; }
 */
export function WithComponent<TEntity extends Entity, TComp extends Component>(
  componentClass: new (...args: any[]) => TComp,
  init: WithComponentInit<TEntity, TComp> = {},
): ClassDecorator {
  return (constructor) => {
    const existing: WithComponentDef[] =
      Reflect.getMetadata(ENTITY_COMPONENTS_KEY, constructor) ?? [];
    Reflect.defineMetadata(
      ENTITY_COMPONENTS_KEY,
      [...existing, { componentClass, init }],
      constructor,
    );
  };
}

/**
 * Returns all component definitions registered on an entity class via
 * @WithComponent. The array is ordered as declared (bottom decorator first,
 * following TypeScript decorator evaluation order).
 */
export function GetWithComponentDefs(
  entityClass: new (...args: any[]) => Entity,
): WithComponentDef[] {
  return Reflect.getMetadata(ENTITY_COMPONENTS_KEY, entityClass) ?? [];
}
