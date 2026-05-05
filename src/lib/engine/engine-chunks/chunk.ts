import { Vector2 } from 'three';
import { CHUNK_SIZE } from './engine-chunks.constants';
import { Entity } from '../engine-entities';
import { Expose } from 'class-transformer';

export class Chunk {
  /**
   * Position of the chunk in 2D space, where x and y represent the chunk coordinates.
   *
   * @type {Vector2}
   */
  position: Vector2;

  /**
   * Size of the chunk in 2D space, typically defined by a constant value.
   *
   * @type {Vector2}
   */
  size: Vector2 = new Vector2(CHUNK_SIZE, CHUNK_SIZE);

  /**
   * A set of entity IDs that are currently within this chunk.
   *
   * @type {Set<string>}
   */
  entities: Set<string> = new Set();

  /**
   * Sessions associated with the chunk, which can be used for tracking which sessions are currently interacting with entities in this chunk.
   *
   * @type {Set<string>}
   */
  sessions: Set<string> = new Set();

  /**
   * Gets the unique identifier for the chunk based on its position.
   *
   * @returns {string} The chunk ID in the format "x:y".
   */
  @Expose()
  get id(): string {
    return `${this.position.x}:${this.position.y}`;
  }

  /**
   * Gets the IDs of neighboring chunks based on the current chunk's position.
   *
   * @returns {string[]} An array of neighboring chunk IDs in the format "x:y".
   */
  @Expose()
  get neighboringChunkIds() {
    return this.getNeighboringChunkIds();
  }

  /**
   * Creates an instance of Chunk.
   *
   * @param {Vector2} position The position of the chunk in 2D space, where x and y represent the chunk coordinates.
   */
  constructor(position: Vector2) {
    this.position = position;
  }

  /**
   * Adds an entity ID to the chunk's set of entities.
   *
   * @param {string} entityId The ID of the entity to add to the chunk.
   */
  add(entityId: string): void {
    this.entities.add(entityId);
  }

  /**
   * Removes an entity ID from the chunk's set of entities.
   *
   * @param {string} entityId The ID of the entity to remove from the chunk.
   */
  remove(entityId: string): void {
    this.entities.delete(entityId);
  }

  /**
   * Checks if an entity ID is present in the chunk's set of entities.
   *
   * @param {string} entityId The ID of the entity to check.
   * @returns {boolean} True if the entity is present, false otherwise.
   */
  has(entityId: string): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Clears all entity IDs from the chunk's set of entities.
   *
   * @returns {void}
   */
  clear(): void {
    this.entities.clear();
  }

  /**
   * Retrieves an array of all entity IDs currently in the chunk.
   *
   * @returns {string[]} An array of entity IDs present in the chunk.
   */
  all(): string[] {
    return Array.from(this.entities);
  }

  /**
   * Adds a session ID to the chunk's set of sessions.
   *
   * @param {string} sessionId The ID of the session to add to the chunk.
   */
  addSession(sessionId: string): void {
    this.sessions.add(sessionId);
  }

  /**
   * Removes a session ID from the chunk's set of sessions.
   *
   * @param {string} sessionId The ID of the session to remove from the chunk.
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Checks if a session ID is present in the chunk's set of sessions.
   *
   * @param {string} sessionId The ID of the session to check.
   * @returns {boolean} True if the session is present, false otherwise.
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Checks if there are any session IDs currently associated with the chunk.
   *
   * @returns {boolean} True if there is at least one session associated with the chunk, false otherwise.
   */
  hasSessions(): boolean {
    return this.sessions.size > 0;
  }

  /**
   * Clears all session IDs from the chunk's set of sessions.
   *
   * @returns {void}
   */
  clearSessions(): void {
    this.sessions.clear();
  }

  /**
   * Retrieves an array of all session IDs currently associated with the chunk.
   *
   * @returns {string[]} An array of session IDs present in the chunk.
   */
  allSessions(): string[] {
    return Array.from(this.sessions);
  }

  /**
   * Gets the number of entities currently in the chunk.
   *
   * @returns {number} The count of entities in the chunk.
   */
  count(): number {
    return this.entities.size;
  }

  /**
   * Gets the IDs of neighboring chunks based on the current chunk's position.
   *
   * @returns {string[]} An array of neighboring chunk IDs in the format "x:y".
   */
  getNeighboringChunkIds(): string[] {
    const neighbors: string[] = [];
    const directions = [
      { x: -1, y: 0 }, // left
      { x: -1, y: -1 }, // top-left
      { x: 1, y: 0 }, // right
      { x: 1, y: -1 }, // top-right
      { x: 0, y: -1 }, // up
      { x: -1, y: 1 }, // bottom-left
      { x: 0, y: 1 }, // down
      { x: 1, y: 1 }, // bottom-right
    ];

    for (const dir of directions) {
      const neighborX = this.position.x + dir.x;
      const neighborY = this.position.y + dir.y;
      neighbors.push(`${neighborX}:${neighborY}`);
    }

    return neighbors;
  }

  /**
   * Creates an instance of Chunk from a given chunk ID.
   *
   * @param {string} id The chunk ID in the format "x:y".
   * @returns {Chunk} An instance of Chunk corresponding to the given ID.
   */
  static fromId(id: string): Chunk {
    const [x, y] = id.split(':').map(Number);

    return new Chunk(new Vector2(x, y));
  }

  /**
   * Creates an instance of Chunk from a given position in 2D space.
   *
   * @param {Vector2} position The position in 2D space, where x and y represent the coordinates.
   * @returns {Chunk} An instance of Chunk corresponding to the given position.
   */
  static fromPosition(position: Vector2): Chunk {
    const chunkX = Math.floor(position.x / CHUNK_SIZE);
    const chunkY = Math.floor(position.y / CHUNK_SIZE);

    return new Chunk(new Vector2(chunkX, chunkY));
  }

  /**
   * Creates an instance of Chunk from a given Entity.
   *
   * @param {Entity} entity The entity from which to create the chunk.
   * @returns {Chunk} An instance of Chunk corresponding to the entity's position.
   */
  static fromEntity(entity: Entity): Chunk {
    const chunkX = Math.floor(entity.position.x / CHUNK_SIZE);
    const chunkY = Math.floor(entity.position.y / CHUNK_SIZE);

    return new Chunk(new Vector2(chunkX, chunkY));
  }

  /**
   * Gets the unique identifier for a chunk based on the position of a given entity.
   *
   * @param {Entity} entity The entity for which to get the corresponding chunk ID based on its position.
   * @returns {string} The chunk ID in the format "x:y" corresponding to the entity's position.
   */
  static getIdFromEntity(entity: Entity): string {
    const chunkX = Math.floor(entity.position.x / CHUNK_SIZE);
    const chunkY = Math.floor(entity.position.y / CHUNK_SIZE);

    return `${chunkX}:${chunkY}`;
  }
}
