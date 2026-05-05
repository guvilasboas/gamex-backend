import { EngineSessionsRegistry } from './engine-sessions.registry';
import { Inject, Injectable } from '@nestjs/common';
import { createSession, Session, SessionAction } from './engine-session.types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ENGINE_SESSIONS_CONNECT,
  ENGINE_SESSIONS_DISCONNECT,
} from './engine-sessions.events';
import set from 'lodash/set';

@Injectable()
export class EngineSessionsManager {
  getById(sessionId: string | undefined) {
    throw new Error('Method not implemented.');
  }
  constructor(
    @Inject(EngineSessionsRegistry)
    private readonly registry: EngineSessionsRegistry,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Connects a session by its ID.
   *
   * @param {Session} session - The session to connect.
   */
  connect(session: Partial<Session>) {
    this.registry.add(createSession(session));

    this.eventEmitter.emit(ENGINE_SESSIONS_CONNECT, session.id);
  }

  /**
   * Disconnects a session by its ID.
   *
   * @param {string} id - The ID of the session to disconnect.
   */
  disconnect(id: string) {
    this.registry.remove(id);

    this.eventEmitter.emit(ENGINE_SESSIONS_DISCONNECT, id);
  }

  /**
   * Sets a value in a session by its ID and key.
   *
   * @param {string} sessionId - The ID of the session to set the value in.
   * @param {string} key - The key of the value to set.
   * @param {T} value - The value to set.
   */
  set<T = unknown>(sessionId: string, key: string, value: T) {
    const session = this.registry.get(sessionId);

    if (!session) {
      return;
    }

    set(session, key, value);
  }

  /**
   * Deletes a value from a session by its ID and key.
   *
   * @param {string} sessionId - The ID of the session to delete the value from.
   * @param {string} key - The key of the value to delete.
   */
  delete(sessionId: string, key: string) {
    const session = this.registry.get(sessionId);

    if (!session) {
      return;
    }

    delete session[key];
  }

  /**
   * Pushes an action to a session by its ID.
   *
   * @param {string} sessionId - The ID of the session to push the action to.
   * @param {SessionAction} action - The action to push.
   */
  pushAction(sessionId: string, action: SessionAction) {
    const session = this.registry.get(sessionId);

    if (!session) {
      return;
    }

    session.actions.push(action);
  }

  /**
   * Retrieves a session by its ID.
   *
   * @param {string} id - The ID of the session to retrieve.
   * @return {Session | undefined} The session with the given ID, or undefined if not found.
   */
  get(id: string) {
    return this.registry.get(id);
  }

  /**
   * Retrieves all sessions.
   *
   * @return {Session[]} An array of all sessions.
   */
  getAll() {
    return this.registry.getAll();
  }
}
