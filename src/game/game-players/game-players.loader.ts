import { PlayerFactory } from './player.factory';
import { Injectable } from '@nestjs/common';
import { CreateStateMachine } from '../../lib/engine/engine-state-machine';
import {
  PLAYER_MOVEMENT_MACHINE_ID,
  PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
} from './player-movement.machine';

@Injectable()
export class GamePlayersLoader {
  /**
   * Loads a player entity by its session ID.
   *
   * @param {string} sessionId The session ID of the player to load.
   * @returns {Player} An instance of Player representing the player.
   */
  loadPlayerEntity(sessionId: string) {
    const player = PlayerFactory.create(sessionId);
    CreateStateMachine(player.id, PLAYER_MOVEMENT_MACHINE_ID, {
      id: PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
    });
    return player;
  }
}
