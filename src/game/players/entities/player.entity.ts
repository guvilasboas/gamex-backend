import { StateMachineComponent } from '../../../lib/engine/engine-state-machine';
import { ColliderComponent } from '../../../lib/engine/engine-collisions';
import { Vector3 } from 'three';
import {
  Entity,
  EntityDef,
  WithComponent,
} from '../../../lib/engine/engine-entities';
import { AnimationComponent } from '../../../lib/engine/engine-render';
import {
  PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
  PLAYER_MOVEMENT_MACHINE_ID,
  PlayerMovementState,
} from '../machines';
import animations from '../animations';

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
@WithComponent(AnimationComponent, {
  id: 'animation',
  resource: animations.idle[PlayerFacing.Down].resource,
  animation: animations.idle[PlayerFacing.Down].animation,
  playing: true,
  frameRate: animations.idle[PlayerFacing.Down].frameRate,
  size: new Vector3(64, 96, 0),
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
   * The speed at which the player moves when running. This is used to calculate movement deltas based on input when the player is running.
   *
   * @type {number}
   */
  runningSpeed = 15;

  /**
   * The current state of the player's movement state machine. This is used to determine the player's animation and behavior based on their movement state.
   *
   * @type {PlayerMovementState}
   */
  movementState: PlayerMovementState = PlayerMovementState.Idle;

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

  /**
   * Checks if the player is currently in the idle state.
   *
   * @returns {boolean} True if the player is idle, false otherwise.
   */
  isIdle(): boolean {
    return this.movementState === PlayerMovementState.Idle;
  }

  /**
   * Sets the player's movement state to idle. This is typically called when the player stops moving to update their state accordingly.
   *
   * @returns {void}
   */
  idle() {
    this.movementState = PlayerMovementState.Idle;
  }

  /**
   * Checks if the player is currently in the walking state.
   *
   * @returns {boolean} True if the player is walking, false otherwise.
   */
  isWalking(): boolean {
    return this.movementState === PlayerMovementState.Walking;
  }

  /**
   * Sets the player's movement state to walking. This is typically called when the player starts moving to update their state accordingly.
   *
   * @returns {void}
   */
  walk() {
    this.movementState = PlayerMovementState.Walking;
  }

  /**
   * Checks if the player is currently in the running state.
   *
   * @returns {boolean} True if the player is running, false otherwise.
   */
  isRunning(): boolean {
    return this.movementState === PlayerMovementState.Running;
  }

  /**
   * Sets the player's movement state to running. This is typically called when the player starts running to update their state accordingly.
   *
   * @returns {void}
   */
  run() {
    this.movementState = PlayerMovementState.Running;
  }
}
