import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_SESSIONS_CONNECT,
  ENGINE_SESSIONS_DISCONNECT,
  SetSessionData,
} from '../../lib/engine/engine-sessions';
import { GamePlayersLoader } from '../game-players/game-players.loader';
import { GetEntity, RemoveEntity } from '../../lib/engine/engine-entities';

@Injectable()
export class GameSessionsSystem {
  constructor(
    @Inject(GamePlayersLoader)
    private readonly gamePlayersLoader: GamePlayersLoader,
  ) {}

  /**
   * Handles the event when a session connects.
   *
   * @param sessionId - The ID of the session that connected.
   */
  @OnEvent(ENGINE_SESSIONS_CONNECT)
  onSessionConnect(sessionId: string) {
    if (GetEntity(sessionId)) {
      return;
    }

    const player = this.gamePlayersLoader.loadPlayerEntity(sessionId);

    SetSessionData(sessionId, 'playerId', player.id);
    SetSessionData(sessionId, 'chunkId', player.chunkId);
  }

  /**
   * Handles the event when a session ends.
   *
   * @param sessionId - The ID of the session that ended.
   */
  @OnEvent(ENGINE_SESSIONS_DISCONNECT)
  onSessionEnd(sessionId: string) {
    RemoveEntity(sessionId);
  }
}
