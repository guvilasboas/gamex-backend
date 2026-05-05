import { plainToInstance } from 'class-transformer';
import { DeepPartial } from 'typeorm';
import { Entity } from './entity';

export class EntityFactory {
  /**
   * Creates an instance of Entity from a plain object.
   *
   * @param {DeepPartial<Entity>} params The plain object containing the properties to initialize the Entity instance.
   * @returns {Entity} An instance of Entity.
   */
  static create(params: DeepPartial<Entity>): Entity {
    return plainToInstance(Entity, params);
  }
}
