import { EngineChunksRegistry } from './engine-chunks.registry';
import { Inject, Injectable } from '@nestjs/common';
import { Entity } from '../engine-entities';
import { Chunk } from './chunk';

@Injectable()
export class EngineChunksManager {
  constructor(
    @Inject(EngineChunksRegistry)
    private readonly engineChunksRegistry: EngineChunksRegistry,
  ) {}

  /**
   * Loads a chunk based on the position of an entity. If the chunk does not exist in the registry, it will be created and added to the registry.
   *
   * @param {Entity} entity The entity for which to load the corresponding chunk based on its position.
   * @returns {Chunk} The loaded chunk corresponding to the entity's position.
   * @throws {Error} If the chunk cannot be loaded for the given entity.
   */
  loadChunkByEntity(entity: Entity): Chunk {
    this.engineChunksRegistry.addIfNotExists(Chunk.fromEntity(entity));

    const chunk = this.engineChunksRegistry.get(Chunk.getIdFromEntity(entity));
    if (!chunk) {
      throw new Error(`Failed to load chunk for entity ${entity.id}`);
    }

    const loadedChunk = this.engineChunksRegistry.get(chunk.id);

    if (!loadedChunk) {
      throw new Error(`Failed to load chunk for entity ${entity.id}`);
    }

    loadedChunk.add(entity.id);

    if (entity.sessionId) {
      loadedChunk.addSession(entity.sessionId);
    }

    return loadedChunk;
  }

  /**
   * Unloads a chunk from the registry based on its ID.
   *
   * @param {string} chunkId The ID of the chunk to unload from the registry.
   */
  unloadChunk(chunkId: string): void {
    this.engineChunksRegistry.remove(chunkId);
  }

  /**
   * Removes an entity from its corresponding chunk based on the entity's position. If the chunk does not exist in the registry, an error will be thrown.
   *
   * @param {Entity} entity The entity to remove from its corresponding chunk based on its position.
   * @throws {Error} If the chunk corresponding to the entity's position cannot be found in the registry.
   */
  removeEntityFromChunk(entity: Entity): void {
    const chunkId = Chunk.getIdFromEntity(entity);
    const chunk = this.engineChunksRegistry.get(chunkId);

    if (!chunk) {
      throw new Error(`Failed to find chunk for entity ${entity.id}`);
    }

    chunk.remove(entity.id);

    if (entity.sessionId) {
      chunk.removeSession(entity.sessionId);
    }

    if (!chunk.hasSessions()) {
      this.unloadChunk(chunkId);
    }
  }
}
