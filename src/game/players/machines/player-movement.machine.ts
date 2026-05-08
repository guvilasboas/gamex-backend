import { StateMachineDefinition } from '../../../lib/engine/engine-state-machine';

export const PLAYER_MOVEMENT_MACHINE_ID = 'player.movement';
export const PLAYER_MOVEMENT_MACHINE_COMPONENT_ID = 'movement';

export enum PlayerMovementState {
  Idle = 'idle',
  Walking = 'walking',
}

export const PlayerMovementMachineDefinition: StateMachineDefinition = {
  id: PLAYER_MOVEMENT_MACHINE_ID,
  initialState: PlayerMovementState.Idle,
  states: {
    [PlayerMovementState.Idle]: {
      id: PlayerMovementState.Idle,
      transitions: {
        start_walking: { to: PlayerMovementState.Walking },
      },
    },
    [PlayerMovementState.Walking]: {
      id: PlayerMovementState.Walking,
      transitions: {
        stop_walking: { to: PlayerMovementState.Idle },
      },
    },
  },
};
