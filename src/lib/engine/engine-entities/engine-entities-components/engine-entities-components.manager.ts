import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineEntitiesComponentsRegistry } from './engine-entities-components.registry';
import { Component } from './component';
import {
  ENGINE_ENTITY_COMPONENT_ADDED_EVENT,
  ENGINE_ENTITY_COMPONENT_REMOVED_EVENT,
  ENGINE_ENTITY_COMPONENT_UPDATED_EVENT,
} from './engine-entities-components.events';

@Injectable()
export class EngineEntitiesComponentsManager {
  constructor(
    @Inject(EngineEntitiesComponentsRegistry)
    private readonly registry: EngineEntitiesComponentsRegistry,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Adds a component to an entity.
   * If a component with the same `id` already exists on the entity, it is
   * replaced and ENGINE_ENTITY_COMPONENT_UPDATED_EVENT is emitted.
   * Otherwise ENGINE_ENTITY_COMPONENT_ADDED_EVENT is emitted.
   */
  add(component: Component): void {
    const existing = this.registry.get(component.entityId, component.id);

    this.registry.add(component);

    if (existing) {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_UPDATED_EVENT, {
        previous: existing,
        next: component,
      });
    } else {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_ADDED_EVENT, component);
    }
  }

  /**
   * Returns a specific component by entity + component id.
   *
   * @param {string} entityId - The ID of the entity to retrieve the component from.
   * @param {string} componentId - The ID of the component to retrieve.
   * @returns {Component | undefined} The component instance if found, or undefined if not found.
   */
  get(entityId: string, componentId: string): Component | undefined {
    return this.registry.get(entityId, componentId);
  }

  /**
   * Returns all component instances of a given type on an entity.
   *
   * @param {string} entityId - The ID of the entity to retrieve components for.
   * @param {new (...args: any[]) => T} componentClass - The class of the component type to retrieve.
   * @returns {T[]} Array of components of the specified type on the entity, or an empty array if none exist.
   */
  getByType<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): T[] {
    return this.registry.getByType(entityId, componentClass);
  }

  /**
   * Returns all components on an entity.
   *
   * @param {string} entityId - The ID of the entity to retrieve components for.
   * @returns {Component[]} Array of all components on the entity, or an empty array if none exist.
   */
  getAll(entityId: string): Component[] {
    return this.registry.getAll(entityId);
  }

  /**
   * Returns true if the entity has at least one component of the given type.
   *
   * @param {string} entityId - The ID of the entity to check for the component.
   * @param {new (...args: any[]) => T} componentClass - The class of the component type to check for.
   * @returns {boolean} True if the entity has at least one component of the specified type, false otherwise.
   */
  has<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): boolean {
    return this.registry.has(entityId, componentClass);
  }

  /**
   * Removes a specific component by component id.
   * Emits ENGINE_ENTITY_COMPONENT_REMOVED_EVENT with the removed instance.
   *
   * @param {string} entityId - The ID of the entity to remove the component from.
   * @param {string} componentId - The ID of the component to remove.
   */
  remove(entityId: string, componentId: string): void {
    const removed = this.registry.remove(entityId, componentId);
    if (removed) {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_REMOVED_EVENT, removed);
    }
  }

  /**
   * Removes all components from an entity.
   * Emits ENGINE_ENTITY_COMPONENT_REMOVED_EVENT for each removed instance.
   * Called automatically by EngineEntitiesComponentsSystem on entity deletion.
   *
   * @param {string} entityId - The ID of the entity to remove all components from.
   * @returns {void}
   */
  removeAll(entityId: string): void {
    const removed = this.registry.removeAll(entityId);
    for (const component of removed) {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_REMOVED_EVENT, component);
    }
  }
}
