import { Component } from '../../engine-entities/engine-entities-components';
import { Renderable } from '../engine-render-decorators';

@Renderable()
export class AnimationComponent extends Component {
  static readonly type = '[Animation]';

  /**
   * The resource identifier for the animation, which could be a path to a sprite sheet or an animation definition in the engine's asset system.
   *
   * @type {string}
   */
  resource: string;

  /**
   * The name of the animation to play, which corresponds to an animation defined in the resource.
   *
   * @type {string}
   */
  animation: string;

  /**
   * A boolean indicating whether the animation is currently playing or paused.
   *
   * @type {boolean}
   */
  playing: boolean;

  /**
   * The frame rate at which the animation should play, typically measured in frames per second (FPS).
   *
   * @type {number}
   */
  frameRate: number;

  /**
   * Sets the resource identifier for the animation.
   *
   * @param {string} resource - The resource identifier.
   */
  setResource(resource: string): void {
    this.resource = resource;
  }

  /**
   * Gets the resource identifier for the animation.
   *
   * @returns {string} The resource identifier.
   */
  getResource(): string {
    return this.resource;
  }

  /**
   * Sets the name of the animation to play.
   *
   * @param {string} animation - The name of the animation.
   */
  setAnimation(animation: string): void {
    this.animation = animation;
  }

  /**
   * Gets the name of the animation to play.
   *
   * @returns {string} The name of the animation.
   */
  getAnimation(): string {
    return this.animation;
  }

  /**
   * Sets whether the animation is currently playing or paused.
   *
   * @param {boolean} playing - True to play the animation, false to pause it.
   */
  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  /**
   * Gets whether the animation is currently playing or paused.
   *
   * @returns {boolean} True if the animation is playing, false if it is paused.
   */
  getPlaying(): boolean {
    return this.playing;
  }

  /**
   * Sets the frame rate at which the animation should play.
   *
   * @param {number} frameRate - The frame rate in frames per second (FPS).
   */
  setFrameRate(frameRate: number): void {
    this.frameRate = frameRate;
  }

  /**
   * Gets the frame rate at which the animation should play.
   *
   * @returns {number} The frame rate in frames per second (FPS).
   */
  getFrameRate(): number {
    return this.frameRate;
  }
}
