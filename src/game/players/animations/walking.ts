export enum WalkingAnimation {
  Up = 'walking_up',
  Down = 'walking_down',
  Left = 'walking_left',
  Right = 'walking_right',
}

export default {
  up: {
    resource: 'npc',
    frameRate: 8,
    animation: WalkingAnimation.Up,
    playing: true,
  },

  down: {
    resource: 'npc',
    frameRate: 8,
    animation: WalkingAnimation.Down,
    playing: true,
  },

  left: {
    resource: 'npc',
    frameRate: 8,
    animation: WalkingAnimation.Left,
    playing: true,
  },

  right: {
    resource: 'npc',
    frameRate: 8,
    animation: WalkingAnimation.Right,
    playing: true,
  },
} as const;
