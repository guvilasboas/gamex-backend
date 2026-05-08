import { StateMachineComponent } from '../../../lib/engine/engine-state-machine';
import { ColliderComponent } from '../../../lib/engine/engine-collisions';
import { Vector3 } from 'three';
import {
  Entity,
  EntityDef,
  WithComponent,
} from '../../../lib/engine/engine-entities';
import { RectComponent } from '../../../lib/engine/engine-render';
import {
  PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
  PLAYER_MOVEMENT_MACHINE_ID,
  PlayerMovementState,
} from '../machines';

export enum PlayerFacing {
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right',
}

@EntityDef({ type: 'player' })
@WithComponent(ColliderComponent, {
  id: 'body',
  size: new Vector3(64, 24, 0),
  offset: new Vector3(0, 72, 0),
  tags: ['player'],
})
@WithComponent<Player, StateMachineComponent>(StateMachineComponent, {
  id: PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
  definitionId: PLAYER_MOVEMENT_MACHINE_ID,
  currentState: PlayerMovementState.Idle,
})
@WithComponent(RectComponent, {
  id: 'sprite',
  size: new Vector3(64, 96, 0),
})
@WithComponent(RectComponent, {
  id: 'collider',
  size: new Vector3(64, 24, 0),
  strokeColor: '#00FF00',
  offset: new Vector3(0, 72, 0),
})
export class Player extends Entity {
  /**
   * The direction the player is currently facing. This is used for rendering and movement.
   *
   * @type {PlayerFacing}
   */
  facing: PlayerFacing = PlayerFacing.Down;

  /**
   * The size of the player entity. This is used for rendering and collision detection.
   *
   * @type {Vector3}
   */
  size = new Vector3(64, 96, 0);

  /**
   * The speed at which the player moves. This is used to calculate movement deltas based on input.
   *
   * @type {number}
   */
  speed = 5;

  /**
   * Set the player's facing direction based on a movement vector. This is typically called when the player moves to update their facing direction accordingly.
   *
   * @param direction - The movement vector indicating the direction of movement.
   */
  setFacingByDirection(direction: Vector3): void {
    if (direction.x < 0) {
      this.facing = PlayerFacing.Left;
    } else if (direction.x > 0) {
      this.facing = PlayerFacing.Right;
    } else if (direction.y < 0) {
      this.facing = PlayerFacing.Up;
    } else if (direction.y > 0) {
      this.facing = PlayerFacing.Down;
    }
  }
}
