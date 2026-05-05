import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { GAME_BEFORE_UPDATE_EVENT } from '../engine.events';
import { EngineSessionsManager } from './engine-sessions.manager';
import { createActionEvent } from './engine-session.types';
import { ENGINE_ENTITY_SESSION_UPDATED_EVENT } from '../engine-entities/engine-entities.events';
import { Entity } from '../engine-entities';

@Injectable()
export class EngineSessionSystem {
  constructor(
    @Inject(EngineSessionsManager)
    private readonly sessionsManager: EngineSessionsManager,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Listens to the ENGINE_ENTITY_SESSION_UPDATED_EVENT and updates the session's chunkId if the entity's sessionId is defined and the chunkId has changed.
   *
   * @param previousEntity - The previous state of the entity before the update.
   * @param entity - The updated entity.
   *
   * @returns {void}
   */
  @OnEvent(ENGINE_ENTITY_SESSION_UPDATED_EVENT)
  onEntitySessionUpdated(previousEntity: Entity, entity: Entity) {
    if (!entity.sessionId) {
      return;
    }

    if (previousEntity.chunkId === entity.chunkId) {
      return;
    }

    this.sessionsManager.set(entity.sessionId, 'chunkId', entity.chunkId);
  }

  /**
   * Listens to the GAME_BEFORE_UPDATE_EVENT and processes all session actions.
   * For each session, it emits an event for each action in the session's action queue.
   *
   * @returns {void}
   */
  @OnEvent(GAME_BEFORE_UPDATE_EVENT)
  onGameBeforeUpdate() {
    const sessions = this.sessionsManager.getAll();
    for (const session of sessions) {
      while (session.actions.length > 0) {
        const action = session.actions.shift();

        if (!action) {
          continue;
        }

        const eventName = createActionEvent(action.type);
        this.sessionsManager.set(session.id, 'lastAction', action);
        this.sessionsManager.set(session.id, 'lastActionEvent', eventName);

        this.eventEmitter.emit(eventName, {
          sessionId: session.id,
          action,
        });
      }
    }
  }
}
