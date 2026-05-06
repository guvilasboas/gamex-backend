import { EngineEntitiesRegistry } from './engine-entities.registry';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject, Injectable } from '@nestjs/common';
import { Entity } from './entity';
import {
  ENGINE_ENTITY_CREATED_EVENT,
  ENGINE_ENTITY_DELETED_EVENT,
  ENGINE_ENTITY_SESSION_UPDATED_EVENT,
  ENGINE_ENTITY_UPDATED_EVENT,
} from './engine-entities.events';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { isEqual } from 'lodash';
import { EngineEntitiesComponentsManager } from './engine-entities-components/engine-entities-components.manager';
import { ComponentFactory } from './engine-entities-components/component-factory';
import { GetWithComponentDefs } from './with-component.decorator';

@Injectable()
export class EngineEntitiesManager {
  constructor(
    @Inject(EngineEntitiesRegistry)
    private readonly engineEntitiesRegistry: EngineEntitiesRegistry,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
    @Inject(EngineEntitiesComponentsManager)
    private readonly componentsManager: EngineEntitiesComponentsManager,
  ) {}

  /**
   * Registers an entity in the engine.
   *
   * @param entity - The entity to register.
   * @returns The registered entity.
   */
  create(entity: Entity): Entity {
    this.engineEntitiesRegistry.add(entity);

    this.eventEmitter.emit(ENGINE_ENTITY_CREATED_EVENT, entity);

    const componentDefs = GetWithComponentDefs(
      entity.constructor as new (...args: any[]) => Entity,
    );
    for (const { componentClass, init } of componentDefs) {
      const params = typeof init === 'function' ? init(entity) : init;
      const component = ComponentFactory.create(componentClass, params);
      component.entityId = entity.id;
      this.componentsManager.add(component);
    }

    return entity;
  }

  /**
   * Removes an entity from the engine by its ID.
   *
   * @param entityId - The ID of the entity to remove.
   */
  remove(entityId: string): void {
    const entity = this.engineEntitiesRegistry.get(entityId);
    if (!entity) {
      return;
    }

    this.engineEntitiesRegistry.remove(entityId);

    this.eventEmitter.emit(ENGINE_ENTITY_DELETED_EVENT, entity);
  }

  /**
   * Retrieves an entity by its ID.
   *
   * @param entityId - The ID of the entity to retrieve.
   * @returns The entity if found, otherwise undefined.
   */
  get<T extends Entity = Entity>(entityId: string): T | undefined {
    const entity = this.engineEntitiesRegistry.get(entityId);
    if (!entity) {
      return undefined;
    }

    const plain = instanceToPlain(entity);

    return plainToInstance(entity.constructor as new () => T, plain) as T;
  }

  update(entity: Entity): void {
    const previousEntity = this.engineEntitiesRegistry.get(entity.id);
    if (!previousEntity) {
      return;
    }

    if (isEqual(instanceToPlain(previousEntity), instanceToPlain(entity))) {
      return;
    }

    this.engineEntitiesRegistry.add(entity);

    this.eventEmitter.emit(ENGINE_ENTITY_UPDATED_EVENT, previousEntity, entity);

    if (!isEqual(instanceToPlain(previousEntity), instanceToPlain(entity))) {
      this.eventEmitter.emit(
        ENGINE_ENTITY_SESSION_UPDATED_EVENT,
        previousEntity,
        entity,
      );
    }
  }

  /**
   * Retrieves all registered entities.
   *
   * @returns An array of all registered entities.
   */
  getAll(): Entity[] {
    return this.engineEntitiesRegistry.getAll();
  }
}
