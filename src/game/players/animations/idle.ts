export enum IdleAnimation {
  Up = 'idle_up',
  Down = 'idle_down',
  Left = 'idle_left',
  Right = 'idle_right',
}

export default {
  up: {
    resource: 'npc',
    frameRate: 8,
    animation: IdleAnimation.Up,
    playing: true,
  },

  down: {
    resource: 'npc',
    frameRate: 8,
    animation: IdleAnimation.Down,
    playing: true,
  },

  left: {
    resource: 'npc',
    frameRate: 8,
    animation: IdleAnimation.Left,
    playing: true,
  },

  right: {
    resource: 'npc',
    frameRate: 8,
    animation: IdleAnimation.Right,
    playing: true,
  },
} as const;
