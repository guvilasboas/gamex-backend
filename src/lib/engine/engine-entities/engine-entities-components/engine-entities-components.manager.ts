import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineEntitiesComponentsRegistry } from './engine-entities-components.registry';
import { Component } from './component';
import {
  ENGINE_ENTITY_COMPONENT_ADDED_EVENT,
  ENGINE_ENTITY_COMPONENT_REMOVED_EVENT,
  ENGINE_ENTITY_COMPONENT_UPDATED_EVENT,
} from './engine-entities-components.events';
import { DeepPartial } from 'typeorm';
import { ClassConstructor, plainToInstance } from 'class-transformer';

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
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_UPDATED_EVENT, component);
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
  get<T extends Component>(
    entityId: string,
    componentId: string,
  ): T | undefined {
    return this.registry.get(entityId, componentId) as T | undefined;
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

  getByEntity(entityId: string): Component[] {
    return this.registry.getByEntity(entityId);
  }

  /**
   * Returns all components on an entity.
   *
   * @param {string} entityId - The ID of the entity to retrieve components for.
   * @returns {Component[]} Array of all components on the entity, or an empty array if none exist.
   */
  getAll(): Component[] {
    return this.registry.getAll();
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

  /**
   * Updates a component's properties by component id.
   * Only the provided properties in `changes` are updated, other properties remain unchanged.
   * Emits ENGINE_ENTITY_COMPONENT_UPDATED_EVENT with previous and next instances.
   *
   * @param {string} entityId - The ID of the entity the component belongs to.
   * @param {string} componentId - The ID of the component to patch.
   * @param {DeepPartial<T>} changes - An object containing the properties to update and their new values.
   */
  patch<T extends Component>(
    entityId: string,
    componentId: string,
    changes: DeepPartial<T>,
  ): void {
    const component = this.registry.get(entityId, componentId);
    if (!component) {
      return;
    }

    const patchedComponent = plainToInstance(
      component.constructor as ClassConstructor<Component>,
      {
        ...component,
        ...changes,
      },
    );

    this.registry.add(patchedComponent);

    this.eventEmitter.emit(
      ENGINE_ENTITY_COMPONENT_UPDATED_EVENT,
      patchedComponent,
    );
  }
}
