import { Injectable } from '@nestjs/common';
import { OnAction } from '../../lib/engine/engine-sessions';
import { Vector3 } from 'three';
import { type MoveAction, MoveActionPayload } from './game-players.actions';
import { GetEntity, UpdateEntity } from '../../lib/engine/engine-entities';
import { WouldCollideAt } from '../../lib/engine/engine-collisions';
import { GetVectorFromDirections } from '../../lib/engine/engine-physics';
import { Player } from './player.entity';

const WALKING_TAG = 'walking';
const IDLE_TAG = 'idle';

@Injectable()
export class GamePlayersSystem {
  @OnAction('move')
  onMoveAction(action: MoveAction) {
    const velocity = GetVectorFromDirections(action.action);
    const isMoving = velocity.lengthSq() > 0;

    const player = GetEntity<Player>(action.sessionId);
    if (!player) {
      return;
    }

    this.syncMovementTags(player, isMoving);

    if (isMoving) {
      const delta = velocity.clone().multiplyScalar(player.speed);
      const futurePosition = player.position.clone().add(delta);
      if (!WouldCollideAt(player.id, futurePosition)) {
        player.move(delta);
      }
    }

    UpdateEntity(player);
  }

  private syncMovementTags(
    player: ReturnType<typeof GetEntity>,
    isMoving: boolean,
  ) {
    if (!player) {
      return;
    }

    if (isMoving) {
      player.addTag(WALKING_TAG);
      player.removeTag(IDLE_TAG);

      return;
    }

    player.addTag(IDLE_TAG);
    player.removeTag(WALKING_TAG);
  }
}
