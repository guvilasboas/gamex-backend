export const ENGINE_STEP_EVENT = 'engine.step';

export type EngineStepEvent = {
  tick: number;
  deltaMs: number;
  timestamp: number;
};

export const GAME_BEFORE_UPDATE_EVENT = 'game.preUpdate';
export const GAME_UPDATE_EVENT = 'game.update';
export const GAME_AFTER_UPDATE_EVENT = 'game.postUpdate';

export const GAME_BEFORE_RENDER_EVENT = 'game.preRender';
export const GAME_RENDER_EVENT = 'game.render';
export const GAME_AFTER_RENDER_EVENT = 'game.postRender';
