import { Container } from '../../../common/container';
import { EngineEntitiesManager } from './engine-entities.manager';
import { Entity } from './entity';

export function GetEntity<T extends Entity = Entity>(
  entityId: string,
): T | undefined {
  const engineEntityManager = Container.get<EngineEntitiesManager>(
    EngineEntitiesManager,
  );

  return engineEntityManager.get<T>(entityId);
}

export function UpdateEntity<T extends Entity = Entity>(entity: T): T {
  const engineEntityManager = Container.get<EngineEntitiesManager>(
    EngineEntitiesManager,
  );

  engineEntityManager.update(entity);

  return entity;
}

export function CreateEntity<T extends Entity = Entity>(entity: T): T {
  const engineEntityManager = Container.get<EngineEntitiesManager>(
    EngineEntitiesManager,
  );

  engineEntityManager.create(entity);

  return entity;
}

export function RemoveEntity(entityId: string) {
  const engineEntityManager = Container.get<EngineEntitiesManager>(
    EngineEntitiesManager,
  );

  engineEntityManager.remove(entityId);
}
