import { Inject, Injectable } from '@nestjs/common';
import { PlayerLoaderService } from '../services';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_SESSIONS_CONNECT,
  ENGINE_SESSIONS_DISCONNECT,
  EngineSessionsManager,
} from '../../../lib/engine/engine-sessions';

@Injectable()
export class PlayersSessionSystem {
  constructor(
    @Inject(EngineSessionsManager)
    private readonly engineSessionsManager: EngineSessionsManager,
    @Inject(PlayerLoaderService)
    private readonly playerLoaderService: PlayerLoaderService,
  ) {}

  /**
   * Handles the event when a session connects.
   *
   * @param sessionId - The ID of the session that connected.
   */
  @OnEvent(ENGINE_SESSIONS_CONNECT)
  onSessionConnect(sessionId: string) {
    const player = this.playerLoaderService.loadPlayer(sessionId);

    this.engineSessionsManager.set(sessionId, 'playerId', player.id);
    this.engineSessionsManager.set(sessionId, 'chunkId', player.chunkId);
  }

  /**
   * Handles the event when a session ends.
   *
   * @param sessionId - The ID of the session that ended.
   */
  @OnEvent(ENGINE_SESSIONS_DISCONNECT)
  onSessionEnd(sessionId: string) {
    this.playerLoaderService.unloadPlayer(sessionId);
  }
}
