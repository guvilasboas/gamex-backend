import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OnUpdate } from '../engine-loop.decorators';
import type { EngineStepEvent } from '../engine.events';
import {
  Component,
  ENGINE_ENTITY_COMPONENT_ADDED_EVENT,
  ENGINE_ENTITY_COMPONENT_REMOVED_EVENT,
} from '../engine-entities/engine-entities-components';
import { EngineStateMachineActiveIndex } from './engine-state-machine-active.index';
import { EngineStateMachineManager } from './engine-state-machine.manager';
import { StateMachineComponent } from './state-machine.component';

@Injectable()
export class EngineStateMachineSystem {
  constructor(
    @Inject(EngineStateMachineManager)
    private readonly manager: EngineStateMachineManager,
    @Inject(EngineStateMachineActiveIndex)
    private readonly activeIndex: EngineStateMachineActiveIndex,
  ) {}

  @OnUpdate()
  onUpdate(event: EngineStepEvent): void {
    for (const { entityId, machineId } of this.activeIndex.getAll()) {
      this.manager.tickMachine(entityId, machineId, event.tick, event.deltaMs);
    }
  }

  @OnEvent(ENGINE_ENTITY_COMPONENT_ADDED_EVENT)
  onComponentAdded(component: Component): void {
    if (!(component instanceof StateMachineComponent)) return;
    this.activeIndex.add(component.entityId, component.id);
  }

  @OnEvent(ENGINE_ENTITY_COMPONENT_REMOVED_EVENT)
  onComponentRemoved(component: Component): void {
    if (!(component instanceof StateMachineComponent)) return;
    this.activeIndex.remove(component.entityId, component.id);
    this.manager.handleRemovedMachine(component);
  }
}
