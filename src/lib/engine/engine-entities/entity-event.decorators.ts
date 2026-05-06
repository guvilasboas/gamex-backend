import { OnEvent } from '@nestjs/event-emitter';
import { Entity } from './entity';
import {
  ENGINE_ENTITY_CREATED_EVENT,
  ENGINE_ENTITY_DELETED_EVENT,
} from './engine-entities.events';
import { GetEntityType } from './entity-def.decorator';

export type EntityEventFilter = {
  /** Match entities whose @EntityDef type equals this string. */
  type?: string;
  /** Match entities that have this tag in their `tags` array. */
  tag?: string;
  /** Match entities that are instances of this class. */
  instanceOf?: new (...args: any[]) => Entity;
};

function matchesEntityFilter(
  entity: Entity,
  filter: EntityEventFilter,
): boolean {
  if (filter.instanceOf && !(entity instanceof filter.instanceOf)) return false;
  if (filter.type && GetEntityType(entity) !== filter.type) return false;
  if (filter.tag && !entity.tags.includes(filter.tag)) return false;
  return true;
}

/**
 * Listens to ENGINE_ENTITY_CREATED_EVENT. When a filter is provided, the
 * method is only called if the created entity matches all filter criteria.
 *
 * @example
 * @OnEntityCreated({ instanceOf: PlayerEntity })
 * onPlayerSpawned(entity: PlayerEntity): void { ... }
 */
export function OnEntityCreated(filter?: EntityEventFilter): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    if (filter) {
      const original = descriptor.value as (entity: Entity) => unknown;
      descriptor.value = function (entity: Entity) {
        if (!matchesEntityFilter(entity, filter)) return;
        return original.call(this, entity);
      };
    }
    OnEvent(ENGINE_ENTITY_CREATED_EVENT)(target, propertyKey, descriptor);
  };
}

/**
 * Listens to ENGINE_ENTITY_DELETED_EVENT. When a filter is provided, the
 * method is only called if the deleted entity matches all filter criteria.
 *
 * @example
 * @OnEntityDeleted({ tag: 'npc' })
 * onNpcRemoved(entity: Entity): void { ... }
 */
export function OnEntityDeleted(filter?: EntityEventFilter): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    if (filter) {
      const original = descriptor.value as (entity: Entity) => unknown;
      descriptor.value = function (entity: Entity) {
        if (!matchesEntityFilter(entity, filter)) return;
        return original.call(this, entity);
      };
    }
    OnEvent(ENGINE_ENTITY_DELETED_EVENT)(target, propertyKey, descriptor);
  };
}
