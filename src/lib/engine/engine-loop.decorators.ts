import { OnEvent } from '@nestjs/event-emitter';
import {
  GAME_BEFORE_UPDATE_EVENT,
  GAME_UPDATE_EVENT,
  GAME_AFTER_UPDATE_EVENT,
  GAME_BEFORE_RENDER_EVENT,
  GAME_RENDER_EVENT,
  GAME_AFTER_RENDER_EVENT,
} from './engine.events';

/**
 * Listens to the BEFORE_UPDATE phase of the game loop.
 * Equivalent to `@OnEvent(GAME_BEFORE_UPDATE_EVENT)`.
 */
export const OnBeforeUpdate = (): MethodDecorator =>
  OnEvent(GAME_BEFORE_UPDATE_EVENT);

/**
 * Listens to the UPDATE phase of the game loop.
 * Equivalent to `@OnEvent(GAME_UPDATE_EVENT)`.
 */
export const OnUpdate = (): MethodDecorator => OnEvent(GAME_UPDATE_EVENT);

/**
 * Listens to the AFTER_UPDATE phase of the game loop.
 * Equivalent to `@OnEvent(GAME_AFTER_UPDATE_EVENT)`.
 */
export const OnAfterUpdate = (): MethodDecorator =>
  OnEvent(GAME_AFTER_UPDATE_EVENT);

/**
 * Listens to the BEFORE_RENDER phase of the game loop.
 * Equivalent to `@OnEvent(GAME_BEFORE_RENDER_EVENT)`.
 */
export const OnBeforeRender = (): MethodDecorator =>
  OnEvent(GAME_BEFORE_RENDER_EVENT);

/**
 * Listens to the RENDER phase of the game loop.
 * Equivalent to `@OnEvent(GAME_RENDER_EVENT)`.
 */
export const OnRender = (): MethodDecorator => OnEvent(GAME_RENDER_EVENT);

/**
 * Listens to the AFTER_RENDER phase of the game loop.
 * Equivalent to `@OnEvent(GAME_AFTER_RENDER_EVENT)`.
 */
export const OnAfterRender = (): MethodDecorator =>
  OnEvent(GAME_AFTER_RENDER_EVENT);
