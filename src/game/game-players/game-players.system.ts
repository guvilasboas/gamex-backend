import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createActionEvent } from '../../lib/engine/engine-sessions';
import { Vector3 } from 'three';
import { type MoveAction, MoveActionPayload } from './game-players.actions';
import { GetEntity, UpdateEntity } from '../../lib/engine/engine-entities';

const WALKING_TAG = 'walking';
const IDLE_TAG = 'idle';

@Injectable()
export class GamePlayersSystem {
  @OnEvent(createActionEvent('move'))
  onMoveAction(action: MoveAction) {
    const velocity = this.getVelocityFromDirection(action.action);
    const isMoving = velocity.lengthSq() > 0;

    const player = GetEntity(action.sessionId);
    if (!player) {
      return;
    }

    this.syncMovementTags(player, isMoving);

    if (isMoving) {
      player.move(velocity.multiplyScalar(5));
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

  private getVelocityFromDirection(direction: MoveActionPayload) {
    const velocity = { x: 0, y: 0 };

    if (direction.up) {
      velocity.y -= 1;
    }
    if (direction.down) {
      velocity.y += 1;
    }
    if (direction.left) {
      velocity.x -= 1;
    }
    if (direction.right) {
      velocity.x += 1;
    }

    return new Vector3(velocity.x, velocity.y, 0);
  }
}
