import { Injectable } from '@nestjs/common';
import { Session } from './engine-session.types';

@Injectable()
export class EngineSessionsRegistry {
  /**
   * A map to store sessions, where the key is the session ID and the value is the Session object.
   *
   * @type {Map<string, Session>}
   */
  sessions: Map<string, Session> = new Map();

  /**
   * Adds a session to the registry.
   *
   * @param {Session} session - The session to add.
   */
  add(session: Session) {
    this.sessions.set(session.id, session);
  }

  /**
   * Retrieves a session by its ID.
   *
   * @param {string} id - The ID of the session to retrieve.
   * @return {Session | undefined} The session with the given ID, or undefined if not found.
   */
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Returns all sessions currently in the registry.
   *
   * @return {Session[]} An array of all sessions.
   */
  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Removes a session from the registry by its ID.
   *
   * @param {string} id - The ID of the session to remove.
   */
  remove(id: string) {
    this.sessions.delete(id);
  }
}
