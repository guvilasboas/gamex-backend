import { ENGINE_STEP_EVENT, EngineStepEvent } from './engine.events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject, Injectable } from '@nestjs/common';

export const ENGINE_STEP_MS = 1000 / 20;

@Injectable()
export class EngineStepper {
  /**
   * The timer reference for the game loop. It is null when the loop is not running.
   *
   * @type {NodeJS.Timeout | null}
   */
  private timer: NodeJS.Timeout | null = null;

  /**
   * The duration of each tick in milliseconds.
   *
   * @type {number}
   */
  private tickMs = ENGINE_STEP_MS;

  /**
   * The current tick count.
   *
   * @type {number}
   */
  private tick = 0;

  /**
   * The timestamp of the last tick.
   *
   * @type {number}
   */
  private lastTimestamp = 0;

  /**
   * Creates an instance of EngineStepper.
   *
   * @param {EventEmitter2} eventEmitter - The event emitter for emitting engine step events.
   */
  constructor(
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Starts the game loop.
   *
   * @returns {void}
   */
  start(): void {
    if (this.timer) {
      return;
    }

    this.lastTimestamp = Date.now();
    this.scheduleNextTick();
  }

  /**
   * Stops the game loop.
   *
   * @returns {void}
   */
  stop(): void {
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * Checks if the game loop is currently running.
   *
   * @returns {boolean} True if the game loop is running, false otherwise.
   */
  isRunning(): boolean {
    return this.timer !== null;
  }

  getTick(): number {
    return this.tick;
  }

  /**
   * Schedules the next tick of the game loop.
   *
   * @returns {void}
   */
  private scheduleNextTick(): void {
    this.timer = setTimeout(() => {
      this.step();

      if (this.timer !== null) {
        this.scheduleNextTick();
      }
    }, this.tickMs);
  }

  /**
   * Executes a single step of the game loop.
   *
   * @returns {void}
   */
  private step(): void {
    const now = Date.now();

    const event: EngineStepEvent = {
      tick: this.tick,
      deltaMs: now - this.lastTimestamp,
      timestamp: now,
    };

    this.tick += 1;
    this.lastTimestamp = now;
    this.eventEmitter.emit(ENGINE_STEP_EVENT, event);
  }
}
