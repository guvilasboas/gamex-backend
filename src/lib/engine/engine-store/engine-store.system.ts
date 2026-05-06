import {
  ENGINE_ENTITY_CREATED_EVENT,
  ENGINE_ENTITY_DELETED_EVENT,
  ENGINE_ENTITY_UPDATED_EVENT,
  Entity,
} from '../engine-entities';
import { EngineEntitiesComponentsManager } from '../engine-entities/engine-entities-components';
import { IsRenderable } from '../engine-render';
import { EngineStoreManager } from './engine-store.manager';
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class EngineStoreSystem {
  constructor(
    @Inject(EngineEntitiesComponentsManager)
    private readonly engineEntitiesComponentsManager: EngineEntitiesComponentsManager,
    @Inject(EngineStoreManager)
    private readonly engineStoreManager: EngineStoreManager,
  ) {}

  /**
   * Event handler for when an engine entity is created.
   *
   * This method listens for the ENGINE_ENTITY_CREATED_EVENT, which is emitted whenever an entity is created.
   * When an entity is created, it patches the engine store with the new entity data using the EngineStoreManager.
   *
   * @param {Entity} entity The newly created entity that triggered the event.
   * @returns {void}
   */
  @OnEvent(ENGINE_ENTITY_CREATED_EVENT)
  onEngineEntityCreated(entity: Entity) {
    this.engineStoreManager.patch<Entity>({
      type: 'set',
      key: `entities.${entity.id}`,
      value: entity,
    });

    const components = this.engineEntitiesComponentsManager
      .getAll(entity.id)
      .filter(IsRenderable);

    for (const component of components) {
      this.engineStoreManager.patch({
        type: 'set',
        key: `components.${component.id}`,
        value: component.getJson(entity),
      });
    }
  }

  /**
   * Event handler for when an engine entity is updated.
   *
   * This method listens for the ENGINE_ENTITY_UPDATED_EVENT, which is emitted whenever an entity is updated.
   * When an entity is updated, it patches the engine store with the updated entity data using the EngineStoreManager.
   *
   * @param {Entity} _ The previous state of the entity before the update (not used in this handler).
   * @param {Entity} entity The updated entity that triggered the event.
   * @returns {void}
   */
  @OnEvent(ENGINE_ENTITY_UPDATED_EVENT)
  onEngineEntityUpdated(_: Entity, entity: Entity) {
    this.engineStoreManager.patch<Entity>({
      type: 'set',
      key: `entities.${entity.id}`,
      value: entity,
    });

    const components = this.engineEntitiesComponentsManager
      .getAll(entity.id)
      .filter(IsRenderable);

    console.log(
      '[DEV] EngineStoreSystem.onEngineEntityUpdated - Updated entity with ID:',
      entity.id,
      'and its renderable components:',
      components.map((c) => c.id),
    );

    for (const component of components) {
      this.engineStoreManager.patch({
        type: 'set',
        key: `components.${component.id}`,
        value: component.getJson(entity),
      });
    }
  }

  /**
   * Event handler for when an engine entity is deleted.
   *
   * This method listens for the ENGINE_ENTITY_DELETED_EVENT, which is emitted whenever an entity is deleted.
   * When an entity is deleted, it patches the engine store to remove the entity data using the EngineStoreManager.
   *
   * @param {Entity} entity The entity that was deleted and triggered the event.
   * @returns {void}
   */
  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEngineEntityDeleted(entity: Entity) {
    this.engineStoreManager.patch<Entity>({
      type: 'delete',
      key: `entities.${entity.id}`,
    });

    const components = this.engineEntitiesComponentsManager
      .getAll(entity.id)
      .filter(IsRenderable);

    for (const component of components) {
      this.engineStoreManager.patch({
        type: 'delete',
        key: `components.${component.id}`,
      });
    }
  }
}
