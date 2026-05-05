import { Inject, Injectable } from '@nestjs/common';
import { Entity } from '../engine-entities';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_ENTITY_CREATED_EVENT,
  ENGINE_ENTITY_DELETED_EVENT,
  ENGINE_ENTITY_SESSION_UPDATED_EVENT,
} from '../engine-entities/engine-entities.events';
import { EngineChunksManager } from './engine-chunks.manager';

@Injectable()
export class EngineChunksSystem {
  constructor(
    @Inject(EngineChunksManager)
    private readonly engineChunksManager: EngineChunksManager,
  ) {}

  /**
   * Handles the event when an entity is created.
   *
   * @param entity - The entity that was created.
   */
  @OnEvent(ENGINE_ENTITY_CREATED_EVENT)
  onEntityCreated(entity: Entity) {
    this.engineChunksManager.loadChunkByEntity(entity);
  }

  /**
   * Handles the event when an entity is deleted.
   *
   * @param entity - The entity that was deleted.
   */
  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEntityDeleted(entity: Entity) {
    this.engineChunksManager.removeEntityFromChunk(entity);
  }

  /**
   * Handles the event when an entity is updated.
   *
   * @param previousEntity - The previous state of the entity before the update.
   * @param entity - The current state of the entity after the update.
   */
  @OnEvent(ENGINE_ENTITY_SESSION_UPDATED_EVENT)
  onEntityUpdated(previousEntity: Entity, entity: Entity) {
    if (previousEntity.chunkId !== entity.chunkId) {
      this.engineChunksManager.removeEntityFromChunk(previousEntity);
      this.engineChunksManager.loadChunkByEntity(entity);
    }
  }
}
