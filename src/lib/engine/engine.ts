import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EngineStepper } from './engine-stepper';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  GAME_UPDATE_EVENT,
  ENGINE_STEP_EVENT,
  GAME_AFTER_UPDATE_EVENT,
  GAME_BEFORE_UPDATE_EVENT,
  GAME_AFTER_RENDER_EVENT,
  GAME_RENDER_EVENT,
  GAME_BEFORE_RENDER_EVENT,
  type EngineStepEvent,
} from './engine.events';

@Injectable()
export class Engine implements OnModuleInit, OnModuleDestroy {
  /**
   * Creates an instance of the Engine class.
   *
   * @param {EngineStepper} stepper - The EngineStepper instance responsible for managing the game loop.
   */
  constructor(
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
    @Inject(EngineStepper)
    private readonly stepper: EngineStepper,
  ) {}

  /**
   * Called when the module is initialized.
   *
   * @returns {void}
   */
  onModuleInit(): void {
    this.stepper.start();
  }

  /**
   * Called when the module is destroyed.
   *
   * @returns {void}
   */
  onModuleDestroy(): void {
    this.stepper.stop();
  }

  /**
   * Event handler for the engine step event. It emits the game update events in the correct order.
   *
   * @returns {void}
   */
  @OnEvent(ENGINE_STEP_EVENT)
  onStep(event: EngineStepEvent): void {
    this.eventEmitter.emit(GAME_BEFORE_UPDATE_EVENT, event);
    this.eventEmitter.emit(GAME_UPDATE_EVENT, event);
    this.eventEmitter.emit(GAME_AFTER_UPDATE_EVENT, event);

    this.eventEmitter.emit(GAME_BEFORE_RENDER_EVENT, event);
    this.eventEmitter.emit(GAME_RENDER_EVENT, event);
    this.eventEmitter.emit(GAME_AFTER_RENDER_EVENT, event);
  }
}
