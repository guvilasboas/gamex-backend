import type { StateMachineDefinition } from '../../lib/engine/engine-state-machine';

export const PLAYER_MOVEMENT_MACHINE_ID = 'player.movement';
export const PLAYER_MOVEMENT_MACHINE_COMPONENT_ID = 'movement';

export type PlayerMovementState = 'idle' | 'walking';

export const PlayerMovementMachineDefinition: StateMachineDefinition = {
  id: PLAYER_MOVEMENT_MACHINE_ID,
  initialState: 'idle' satisfies PlayerMovementState,
  states: {
    idle: {
      id: 'idle',
      transitions: {
        start_walking: { to: 'walking' },
      },
    },
    walking: {
      id: 'walking',
      transitions: {
        stop_walking: { to: 'idle' },
      },
    },
  },
};
