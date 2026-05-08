import { OnEvent } from '@nestjs/event-emitter';
import { EngineEntitiesManager } from '../engine-entities';
import {
  Component,
  ENGINE_ENTITY_COMPONENT_REMOVED_EVENT,
  EngineEntitiesComponentsManager,
} from '../engine-entities/engine-entities-components';
import { OnBeforeRender, OnBeforeUpdate } from '../engine-loop.decorators';
import { IsRenderable } from '../engine-render';
import {
  EngineStoreManager,
  type EngineStorePatch,
} from './engine-store.manager';
import { Inject, Injectable } from '@nestjs/common';
import { isEqual } from 'lodash';

@Injectable()
export class EngineStoreSystem {
  private state: Record<string, ReturnType<Component['getJson']>> = {};

  constructor(
    @Inject(EngineEntitiesComponentsManager)
    private readonly engineEntitiesComponentsManager: EngineEntitiesComponentsManager,
    @Inject(EngineEntitiesManager)
    private readonly engineEntitiesManager: EngineEntitiesManager,
    @Inject(EngineStoreManager)
    private readonly engineStoreManager: EngineStoreManager,
  ) {}

  @OnBeforeUpdate()
  onBeforeUpdate() {
    this.state = this.getState();
  }

  @OnBeforeRender()
  onBeforeRender() {
    const newState = this.getState();

    const patches = this.getLodashPatches(this.state, newState);

    if (patches.length === 0) {
      return;
    }

    for (const patch of patches) {
      this.engineStoreManager.patch(patch);
    }
  }

  private getState() {
    const state: Record<string, ReturnType<Component['getJson']>> = {};

    const renderables = this.engineEntitiesComponentsManager
      .getAll()
      .filter(IsRenderable);

    for (const component of renderables) {
      const entity = this.engineEntitiesManager.get(component.entityId);

      if (!entity) {
        continue;
      }

      state[component.getIndex()] = component.getJson(entity);
    }

    return state;
  }

  private getLodashPatches(
    oldState: Record<string, any>,
    newState: Record<string, any>,
  ): EngineStorePatch[] {
    const patches: EngineStorePatch[] = [];

    const allKeys = new Set([
      ...Object.keys(oldState),
      ...Object.keys(newState),
    ]);

    for (const key of allKeys) {
      const oldValue = oldState[key];
      const newValue = newState[key];
      if (newValue === undefined) {
        console.log(`[DEV] Key ${key} was removed`);

        patches.push({ type: 'delete', key: `components.${key}` });
        continue;
      }

      if (oldValue === undefined || !isEqual(oldValue, newValue)) {
        patches.push({
          type: 'set',
          key: `components.${key}`,
          value: newValue,
        });
      }
    }

    return patches;
  }

  @OnEvent(ENGINE_ENTITY_COMPONENT_REMOVED_EVENT)
  onEntityComponentRemoved(component: Component) {
    this.engineStoreManager.patch({
      type: 'delete',
      key: `components.${component.getIndex()}`,
    });
  }
}
