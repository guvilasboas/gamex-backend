import { EngineEntitiesManager } from '../../../lib/engine/engine-entities';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Player } from '../entities';

@Injectable()
export class PlayerFactoryService {
  constructor(
    @Inject(EngineEntitiesManager)
    private readonly engineEntitiesManager: EngineEntitiesManager,
  ) {}

  /**
   * Creates a new player entity with the given session ID and partial properties.
   *
   * @param {string} sessionId - The session ID to associate with the player.
   * @param {Partial<Player>} partial - Partial properties to override the default player properties.
   * @returns {Player} The created player entity.
   */
  create(sessionId: string, partial: Partial<Player>): Player {
    const player = plainToInstance(Player, {
      sessionId,
      id: sessionId,
      ...partial,
    });

    this.engineEntitiesManager.create(player);

    return player;
  }
}
