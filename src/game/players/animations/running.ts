export enum RunningAnimation {
  Up = 'running_up',
  Down = 'running_down',
  Left = 'running_left',
  Right = 'running_right',
}

export default {
  up: {
    resource: 'npc',
    frameRate: 8,
    animation: RunningAnimation.Up,
    playing: true,
  },

  down: {
    resource: 'npc',
    frameRate: 8,
    animation: RunningAnimation.Down,
    playing: true,
  },

  left: {
    resource: 'npc',
    frameRate: 8,
    animation: RunningAnimation.Left,
    playing: true,
  },

  right: {
    resource: 'npc',
    frameRate: 8,
    animation: RunningAnimation.Right,
    playing: true,
  },
} as const;
