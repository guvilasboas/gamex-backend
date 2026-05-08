import { EngineCollisionsManager } from '../../../lib/engine/engine-collisions';
import { EngineEntitiesManager } from '../../../lib/engine/engine-entities';
import { EngineInputManager } from '../../../lib/engine/engine-input';
import { Inject, Injectable } from '@nestjs/common';
import { OnUpdate } from '../../../lib/engine';
import { Player } from '../entities';
import { Vector3 } from 'three';

@Injectable()
export class PlayersMovementSystem {
  constructor(
    @Inject(EngineCollisionsManager)
    private readonly collisionsManager: EngineCollisionsManager,
    @Inject(EngineEntitiesManager)
    private readonly entities: EngineEntitiesManager,
    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  /**
   * System update method that runs every tick to handle player movement based on input and collision detection.
   *
   * @returns {void}
   */
  @OnUpdate()
  onUpdate(): void {
    for (const player of this.entities.getOfType<Player>(Player)) {
      if (!player.sessionId) {
        continue;
      }

      const direction = this.getMovementDirection(player.sessionId);
      const isMoving = direction.lengthSq() > 0;

      if (isMoving) {
        player.walk();
        player.setFacingByDirection(direction);

        const delta = direction.multiplyScalar(player.speed);
        const futurePosition = player.position.clone().add(delta);

        if (!this.collisionsManager.wouldCollideAt(player.id, futurePosition)) {
          player.move(delta);
        }
      } else {
        player.idle();
      }

      this.entities.update(player);
    }
  }

  /**
   * Calculates the movement direction based on player input.
   *
   * @param sessionId - The ID of the player's session.
   * @param isStale - Whether the input is considered stale.
   * @returns A Vector3 representing the movement direction.
   */
  private getMovementDirection(sessionId: string): Vector3 {
    const direction = new Vector3(0, 0, 0);

    if (this.input.isDown(sessionId, 'move.up')) {
      direction.y -= 1;
    }

    if (this.input.isDown(sessionId, 'move.down')) {
      direction.y += 1;
    }

    if (this.input.isDown(sessionId, 'move.left')) {
      direction.x -= 1;
    }

    if (this.input.isDown(sessionId, 'move.right')) {
      direction.x += 1;
    }

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    return direction;
  }
}
