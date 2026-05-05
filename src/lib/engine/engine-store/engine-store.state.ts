import { EngineEntitiesManager } from '../engine-entities/engine-entities.manager';
import { Inject, Injectable } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { set } from 'lodash';

export type EngineGameState = ReturnType<EngineStoreState['getSnapshot']>;

@Injectable()
export class EngineStoreState {
  constructor(
    @Inject(EngineEntitiesManager)
    private readonly engineEntitiesManager: EngineEntitiesManager,
  ) {}

  /**
   * Get the current state of all entities in the engine store.
   *
   * @returns A map of entity IDs to their corresponding entity objects.
   */
  private getEntitiesState() {
    const entities = this.engineEntitiesManager.getAll();

    const entitiesMap = {};

    for (const entity of entities) {
      set(entitiesMap, entity.id, instanceToPlain(entity));
    }

    return entitiesMap;
  }

  /**
   * Get a snapshot of the current state of the engine store, including all entities.
   *
   * @returns An object representing the current state of the engine store.
   */
  getSnapshot() {
    return {
      entities: this.getEntitiesState(),
    };
  }
}
