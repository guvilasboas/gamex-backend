import { PlayerFactory } from './player.factory';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GamePlayersLoader {
  /**
   * Loads a player entity by its session ID.
   *
   * @param {string} sessionId The session ID of the player to load.
   * @returns {Player} An instance of Player representing the player.
   */
  loadPlayerEntity(sessionId: string) {
    return PlayerFactory.create(sessionId);
  }
}
