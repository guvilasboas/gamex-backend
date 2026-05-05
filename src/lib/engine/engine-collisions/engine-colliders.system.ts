import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENGINE_ENTITY_DELETED_EVENT, Entity } from '../engine-entities';
import { EngineCollidersRegistry } from './engine-colliders.registry';

@Injectable()
export class EngineCollidersSystem {
  constructor(
    @Inject(EngineCollidersRegistry)
    private readonly collidersRegistry: EngineCollidersRegistry,
  ) {}

  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEntityDeleted(entity: Entity): void {
    this.collidersRegistry.removeAll(entity.id);
  }
}
