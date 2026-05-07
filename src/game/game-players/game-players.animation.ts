export const PLAYER_ANIMATION_COMPONENT_ID = 'animation';
export const PLAYER_ANIMATION_FRAME_RATE = 8;

export const WALKING_UP_ANIMATION = 'walking_up';
export const WALKING_DOWN_ANIMATION = 'walking_down';
export const WALKING_LEFT_ANIMATION = 'walking_left';
export const WALKING_RIGHT_ANIMATION = 'walking_right';

export const IDLE_UP_ANIMATION = 'idle_up';
export const IDLE_DOWN_ANIMATION = 'idle_down';
export const IDLE_LEFT_ANIMATION = 'idle_left';
export const IDLE_RIGHT_ANIMATION = 'idle_right';

export const PLAYER_ANIMATIONS = [
  WALKING_UP_ANIMATION,
  WALKING_DOWN_ANIMATION,
  WALKING_LEFT_ANIMATION,
  WALKING_RIGHT_ANIMATION,
  IDLE_UP_ANIMATION,
  IDLE_DOWN_ANIMATION,
  IDLE_LEFT_ANIMATION,
  IDLE_RIGHT_ANIMATION,
];

export const PLAYER_ANIMATION_RESOURCE = 'npc';

export type PlayerFacing = 'up' | 'down' | 'left' | 'right';

const ANIMATION_MAP: Record<string, Record<PlayerFacing, string>> = {
  idle: {
    up: IDLE_UP_ANIMATION,
    down: IDLE_DOWN_ANIMATION,
    left: IDLE_LEFT_ANIMATION,
    right: IDLE_RIGHT_ANIMATION,
  },
  walking: {
    up: WALKING_UP_ANIMATION,
    down: WALKING_DOWN_ANIMATION,
    left: WALKING_LEFT_ANIMATION,
    right: WALKING_RIGHT_ANIMATION,
  },
};

export function resolvePlayerAnimation(
  state: string,
  facing: PlayerFacing,
): string {
  return ANIMATION_MAP[state]?.[facing] ?? IDLE_DOWN_ANIMATION;
}
