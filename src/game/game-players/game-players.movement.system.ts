import { Inject, Injectable } from '@nestjs/common';
import { OnUpdate } from '../../lib/engine/engine-decorators';
import { EngineInputManager } from '../../lib/engine/engine-input';
import { EngineEntitiesRegistry } from '../../lib/engine/engine-entities/engine-entities.registry';
import { WouldCollideAt } from '../../lib/engine/engine-collisions';
import { UpdateEntity } from '../../lib/engine/engine-entities';
import { Vector3 } from 'three';
import { Player } from './player.entity';
import { EngineEntitiesManager } from '../../lib/engine/engine-entities/engine-entities.manager';

const INPUT_STALE_TICKS = 10;

const WALKING_TAG = 'walking';
const IDLE_TAG = 'idle';

@Injectable()
export class GamePlayersMovementSystem {
  constructor(
    @Inject(EngineEntitiesManager)
    private readonly entities: EngineEntitiesManager,

    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  @OnUpdate()
  onUpdate(): void {
    for (const player of this.entities.getOfType(Player)) {
      if (!player.sessionId) continue;

      if (this.input.isStale(player.sessionId, INPUT_STALE_TICKS)) {
        this.syncMovementTags(player, false);
        UpdateEntity(player);
        continue;
      }

      const direction = this.getMovementDirection(player.sessionId);
      const isMoving = direction.lengthSq() > 0;

      this.syncMovementTags(player, isMoving);

      if (isMoving) {
        this.syncFacing(player, direction);

        const delta = direction.multiplyScalar(player.speed);
        const futurePosition = player.position.clone().add(delta);

        if (!WouldCollideAt(player.id, futurePosition)) {
          player.move(delta);
        }
      }

      UpdateEntity(player);
    }
  }

  private getMovementDirection(sessionId: string): Vector3 {
    const direction = new Vector3(0, 0, 0);

    if (this.input.isDown(sessionId, 'move.up')) direction.y -= 1;
    if (this.input.isDown(sessionId, 'move.down')) direction.y += 1;
    if (this.input.isDown(sessionId, 'move.left')) direction.x -= 1;
    if (this.input.isDown(sessionId, 'move.right')) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    return direction;
  }

  private syncMovementTags(player: Player, isMoving: boolean): void {
    if (isMoving) {
      player.addTag(WALKING_TAG);
      player.removeTag(IDLE_TAG);
    } else {
      player.addTag(IDLE_TAG);
      player.removeTag(WALKING_TAG);
    }
  }

  private syncFacing(player: Player, direction: Vector3): void {
    if (direction.x < 0) {
      player.facing = 'left';
    } else if (direction.x > 0) {
      player.facing = 'right';
    } else if (direction.y < 0) {
      player.facing = 'up';
    } else if (direction.y > 0) {
      player.facing = 'down';
    }
  }
}
