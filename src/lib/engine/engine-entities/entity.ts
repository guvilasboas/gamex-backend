import { Expose, Type } from 'class-transformer';
import { Chunk } from '../engine-chunks';
import { Vector3 } from 'three';

export class Entity {
  /**
   * Unique identifier for the entity.
   *
   * @type {string}
   */
  id: string;

  /**
   * Position of the entity in 3D space.
   *
   * @type {Vector3}
   */
  @Type(() => Vector3)
  position: Vector3 = new Vector3(0, 0, 0);

  /**
   * Size of the entity in 3D space.
   *
   * @type {Vector3}
   */
  @Type(() => Vector3)
  size: Vector3 = new Vector3(0, 0, 0);

  /**
   * Velocity of the entity in 3D space.
   *
   * @type {Vector3}
   */
  @Type(() => Vector3)
  velocity: Vector3 = new Vector3(0, 0, 0);

  /**
   * Gets the facing direction of the entity based on its velocity.
   *
   * @returns {'up' | 'down' | 'left' | 'right'} The facing direction of the entity.
   */
  facing: 'up' | 'down' | 'left' | 'right' = 'down';

  /**
   * Tags associated with the entity for categorization or filtering purposes.
   *
   * @type {string[]}
   */
  tags: string[] = [];

  /**
   * The session ID associated with the entity, if applicable.
   *
   * @type {string}
   */
  sessionId?: string;

  /**
   * Gets the chunk ID corresponding to the entity's position.
   *
   * @returns {string} The chunk ID in the format "x:y" based on the entity's position.
   */
  @Expose()
  get chunkId(): string {
    return Chunk.getIdFromEntity(this);
  }

  /**
   * Setter for chunkId is intentionally left empty to prevent direct setting of chunkId.
   * The chunkId is derived from the entity's position and should not be set manually.
   *
   * @param {string} value The value to set for chunkId (ignored).
   */
  set chunkId(value: string) {
    // This setter is intentionally left empty to prevent setting chunkId directly.
    // The chunkId is derived from the entity's position and should not be set manually.
  }

  /**
   * Creates an instance of Entity.
   *
   * @returns {string} The unique identifier of the entity.
   */
  getId(): string {
    return this.id;
  }

  /**
   * Sets the unique identifier for the entity.
   *
   * @param {string} id The unique identifier to set for the entity.
   */
  setId(id: string): void {
    this.id = id;
  }

  /**
   * Gets the session ID associated with the entity.
   *
   * @returns {string | undefined} The session ID associated with the entity, or undefined if not set.
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Sets the session ID for the entity.
   *
   * @param {string} sessionId The session ID to associate with the entity.
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Gets the facing direction of the entity.
   *
   * @returns {'up' | 'down' | 'left' | 'right'} The facing direction of the entity.
   */
  getFacing(): 'up' | 'down' | 'left' | 'right' {
    return this.facing;
  }

  /**
   * Sets the facing direction of the entity.
   *
   * @param {'up' | 'down' | 'left' | 'right'} facing The new facing direction to set for the entity.
   */
  setFacing(facing: 'up' | 'down' | 'left' | 'right'): void {
    this.facing = facing;
  }

  /**
   * Gets the position of the entity.
   *
   * @returns {Vector3} The current position of the entity.
   */
  getPosition(): Vector3 {
    return this.position;
  }

  /**
   * Sets the position of the entity.
   *
   * @param {Vector3} position The new position to set for the entity.
   */
  setPosition(position: Vector3): void {
    this.position = position;
  }

  /**
   * Gets the size of the entity.
   *
   * @returns {Vector3} The current size of the entity.
   */
  getSize(): Vector3 {
    return this.size;
  }

  /**
   * Sets the size of the entity.
   *
   * @param {Vector3} size The new size to set for the entity.
   */
  setSize(size: Vector3): void {
    this.size = size;
  }

  /**
   * Gets the velocity of the entity.
   *
   * @returns {Vector3} The current velocity of the entity.
   */
  getVelocity(): Vector3 {
    return this.velocity;
  }

  /**
   * Sets the velocity of the entity.
   *
   * @param {Vector3} velocity The new velocity to set for the entity.
   */
  setVelocity(velocity: Vector3): void {
    this.velocity = velocity;
  }

  /**
   * Gets the tags associated with the entity.
   *
   * @returns {string[]} An array of tags associated with the entity.
   */
  getTags(): string[] {
    return this.tags;
  }

  /**
   * Sets the tags for the entity.
   *
   * @param {string[]} tags An array of tags to associate with the entity.
   */
  setTags(tags: string[]): void {
    this.tags = tags;
  }

  /**
   * Adds a tag to the entity if it doesn't already exist.
   *
   * @param {string} tag The tag to add to the entity.
   */
  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  /**
   * Removes a tag from the entity if it exists.
   *
   * @param {string} tag The tag to remove from the entity.
   */
  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  /**
   * Moves the entity by a given delta vector and updates its facing direction accordingly.
   *
   * @param {Vector3} delta The vector by which to move the entity.
   */
  move(delta: Vector3): void {
    this.position.add(delta);
    this.facing = this.getFacingByVector(delta);
  }

  /**
   * Determines the facing direction of the entity based on a given velocity vector.
   *
   * @param {Vector3} vector The velocity vector to determine the facing direction from.
   * @returns {'up' | 'down' | 'left' | 'right'} The facing direction based on the velocity vector.
   */
  getFacingByVector(vector: Vector3): 'up' | 'down' | 'left' | 'right' {
    if (vector.x > 0) {
      return 'right';
    } else if (vector.x < 0) {
      return 'left';
    } else if (vector.y > 0) {
      return 'down';
    } else if (vector.y < 0) {
      return 'up';
    }
    return 'down';
  }
}
