import { Inject, Injectable } from '@nestjs/common';
import { EngineEntitiesRegistry } from '../engine-entities';
import { EngineChunksRegistry } from '../engine-chunks';
import { instanceToPlain } from 'class-transformer';
import { EngineSessionsRegistry } from '../engine-sessions';
import { EngineCollisionsRegistry } from '../engine-collisions';

@Injectable()
export class EngineDebug {
  constructor(
    @Inject(EngineCollisionsRegistry)
    private readonly collisionsRegistry: EngineCollisionsRegistry,
    @Inject(EngineSessionsRegistry)
    private readonly sessionsRegistry: EngineSessionsRegistry,
    @Inject(EngineEntitiesRegistry)
    private readonly entitiesRegistry: EngineEntitiesRegistry,
    @Inject(EngineChunksRegistry)
    private readonly chunksRegistry: EngineChunksRegistry,
  ) {}

  /**
   * Retrieves debug information about the engine, including sessions, entities, and chunks.
   *
   * @returns An object containing arrays of sessions, entities, and chunks, along with a timestamp.
   */
  getDebugInfo() {
    return {
      collisions: this.getCollisionsInfo(),
      sessions: this.getSessionsInfo(),
      entities: this.getEntitiesInfo(),
      chunks: this.getChunksInfo(),
      timestamp: new Date(),
    };
  }

  /**
   * Retrieves information about all sessions in the engine.
   *
   * @returns An array of plain objects representing the sessions.
   */
  private getSessionsInfo() {
    const sessions = this.sessionsRegistry.getAll();
    return sessions.map((session) => instanceToPlain(session));
  }

  /**
   * Retrieves information about all entities in the engine.
   *
   * @returns An array of plain objects representing the entities.
   */
  private getEntitiesInfo() {
    const entities = this.entitiesRegistry.getAll();
    return entities.map((entity) => instanceToPlain(entity));
  }

  /**
   * Retrieves information about all chunks in the engine.
   *
   * @returns An array of plain objects representing the chunks.
   */
  private getChunksInfo() {
    const chunks = this.chunksRegistry.getAll();
    return chunks.map((chunk) => instanceToPlain(chunk));
  }

  /**
   * Retrieves information about all collisions in the engine.
   *
   * @returns An array of plain objects representing the collisions.
   */
  private getCollisionsInfo() {
    const collisions = this.collisionsRegistry.getAll();
    return collisions.map((collision) => instanceToPlain(collision));
  }
}
