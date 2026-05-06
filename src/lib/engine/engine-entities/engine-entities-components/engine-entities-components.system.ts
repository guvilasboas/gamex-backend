import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENGINE_ENTITY_DELETED_EVENT } from '../engine-entities.events';
import { Entity } from '../entity';
import { EngineEntitiesComponentsManager } from './engine-entities-components.manager';

@Injectable()
export class EngineEntitiesComponentsSystem {
  constructor(
    @Inject(EngineEntitiesComponentsManager)
    private readonly manager: EngineEntitiesComponentsManager,
  ) {}

  /**
   * When an entity is deleted, remove all its components.
   * The manager emits ENGINE_ENTITY_COMPONENT_REMOVED_EVENT for each one,
   * so external systems receive individual removal notifications even during
   * entity deletion — no special-case handling needed on the consumer side.
   */
  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEntityDeleted(entity: Entity): void {
    this.manager.removeAll(entity.id);
  }
}
