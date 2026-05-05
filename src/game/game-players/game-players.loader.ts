import { plainToInstance } from 'class-transformer';
import { GamePlayer } from './game-player.entity';
import { Injectable } from '@nestjs/common';
import { CreateEntity } from '../../lib/engine/engine-entities';
import { Vector3 } from 'three';
import { AddCollider } from '../../lib/engine/engine-collisions';
import { random } from 'lodash';

@Injectable()
export class GamePlayersLoader {
  /**
   * Loads a player entity by its session ID.
   *
   * @param {string} sessionId The session ID of the player to load.
   * @returns {Entity} An instance of Entity representing the player.
   */
  loadPlayerEntity(sessionId: string) {
    const player = plainToInstance(GamePlayer, {
      id: sessionId,
      sessionId,
      tags: ['player', 'idle', 'collidable'],
    });

    CreateEntity(player);

    AddCollider({
      id: sessionId,
      entityId: player.id,
      size: new Vector3(64, 24, 0),
      tags: [sessionId],
    });

    return player;
  }
}
