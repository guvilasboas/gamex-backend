import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GAME_AFTER_UPDATE_EVENT } from '../engine.events';
import { EngineCollisionsManager } from './engine-collisions.manager';

@Injectable()
export class EngineCollisionsSystem {
  constructor(
    @Inject(EngineCollisionsManager)
    private readonly collisionsManager: EngineCollisionsManager,
  ) {}

  @OnEvent(GAME_AFTER_UPDATE_EVENT)
  onGameAfterUpdate(): void {
    this.collisionsManager.detectAndEmit();
  }
}
