import { plainToInstance } from 'class-transformer';
import { GamePlayer } from './game-player.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GamePlayersLoader {
  /**
   * Loads a player entity by its session ID.
   *
   * @param {string} sessionId The session ID of the player to load.
   * @returns {Entity} An instance of Entity representing the player.
   */
  loadPlayerEntity(sessionId: string) {
    return plainToInstance(GamePlayer, {
      id: sessionId,
      sessionId,
      tags: ['player', 'idle'],
    });
  }
}
