import { Injectable } from '@nestjs/common';
import { Entity } from './entity';

@Injectable()
export class EngineEntitiesRegistry {
  /**
   * A map to store entities, where the key is the entity's unique ID and the value is the entity itself.
   *
   * @type {Map<string, Entity>}
   */
  entities: Map<string, Entity> = new Map();

  /**
   * Adds an entity to the registry.
   *
   * @param {Entity} entity The entity to add to the registry.
   */
  add(entity: Entity) {
    this.entities.set(entity.id, entity);
  }

  /**
   * Adds an entity to the registry only if an entity with the same ID does not already exist.
   *
   * @param {Entity} entity The entity to add to the registry if it does not already exist.
   * @returns {void}
   */
  addIfNotExists(entity: Entity) {
    if (this.entities.has(entity.id)) {
      return;
    }

    this.entities.set(entity.id, entity);
  }

  /**
   * Retrieves an entity from the registry by its unique ID.
   *
   * @param {string} id The unique identifier of the entity to retrieve.
   * @returns {Entity | undefined} The entity associated with the given ID, or undefined if not found.
   */
  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Retrieves all entities currently stored in the registry.
   *
   * @returns {Entity[]} An array of all entities in the registry.
   */
  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Removes an entity from the registry by its unique ID.
   *
   * @param {string} id The unique identifier of the entity to remove.
   */
  remove(id: string) {
    this.entities.delete(id);
  }
}
