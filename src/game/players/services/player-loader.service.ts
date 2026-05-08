import { PlayerFactoryService } from './player-factory.service';
import { EngineEntitiesManager } from '../../../lib/engine/engine-entities';
import { Inject, Injectable } from '@nestjs/common';
import { Vector3 } from 'three';
import { random } from 'lodash';

@Injectable()
export class PlayerLoaderService {
  constructor(
    @Inject(EngineEntitiesManager)
    private readonly engineEntitiesManager: EngineEntitiesManager,
    @Inject(PlayerFactoryService)
    private readonly playerFactoryService: PlayerFactoryService,
  ) {}

  /**
   * Loads a player entity for the given session ID.
   *
   * @param {string} sessionId - The session ID to load the player for.
   * @returns {Player} The loaded player entity.
   */
  loadPlayer(sessionId: string) {
    const isLoaded = this.engineEntitiesManager.get(sessionId);

    if (isLoaded) {
      return isLoaded;
    }

    const position = new Vector3(random(0, 1000), random(0, 1000), 0);

    const player = this.playerFactoryService.create(sessionId, {
      position,
    });

    return player;
  }

  /**
   * Unloads the player entity associated with the given session ID.
   *
   * @param {string} sessionId - The session ID to unload the player for.
   */
  unloadPlayer(sessionId: string) {
    this.engineEntitiesManager.remove(sessionId);
  }
}
