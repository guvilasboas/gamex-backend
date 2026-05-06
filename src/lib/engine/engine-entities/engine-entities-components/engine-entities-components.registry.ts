import { Injectable } from '@nestjs/common';
import { Component } from './component';

@Injectable()
export class EngineEntitiesComponentsRegistry {
  /**
   * entityId → flat list of all component instances on that entity.
   *
   * Multiple instances of the same component type are allowed, distinguished
   * by their `id` field. This mirrors the same structure used by
   * EngineCollidersRegistry (entityId → Collider[]).
   *
   * @type {Map<string, Component[]>}
   */
  private readonly components: Map<string, Component[]> = new Map();

  /**
   * Adds a component to an entity.
   * If a component with the same `id` already exists on the entity, it is
   * replaced. Otherwise the component is appended to the entity's list.
   *
   * @param {Component} component The component instance to add to the registry.
   */
  add(component: Component): void {
    const list = this.components.get(component.entityId) ?? [];
    const index = list.findIndex((c) => c.id === component.id);

    if (index !== -1) {
      list[index] = component;
    } else {
      list.push(component);
    }

    this.components.set(component.entityId, list);
  }

  /**
   * Returns a specific component by entity + component id, or undefined.
   *
   * @param {string} entityId The ID of the entity to retrieve the component from.
   * @param {string} componentId The ID of the component to retrieve.
   * @returns {Component | undefined} The component instance if found, or undefined if not found.
   */
  get(entityId: string, componentId: string): Component | undefined {
    return this.components.get(entityId)?.find((c) => c.id === componentId);
  }

  /**
   * Returns all component instances of a given type on an entity.
   *
   * @param {string} entityId The ID of the entity to retrieve components for.
   * @param {new (...args: any[]) => T} componentClass The class of the component type to retrieve.
   * @returns {T[]} Array of components of the specified type on the entity, or an empty array if none exist.
   */
  getByType<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): T[] {
    const list = this.components.get(entityId);
    if (!list) return [];
    return list.filter((c): c is T => c instanceof componentClass);
  }

  /**
   * Returns all components on an entity.
   *
   * @param {string} entityId The ID of the entity to retrieve components for.
   * @returns {Component[]} Array of all components on the entity, or an empty array if none exist.
   */
  getAll(entityId: string): Component[] {
    return this.components.get(entityId) ?? [];
  }

  /**
   * Returns true if the entity has at least one component of the given type.
   *
   * @param {string} entityId The ID of the entity to check for the component.
   * @param {new (...args: any[]) => T} componentClass The class of the component type to check for.
   * @returns {boolean} True if the entity has at least one component of the specified type, false otherwise.
   */
  has<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): boolean {
    return (
      this.components.get(entityId)?.some((c) => c instanceof componentClass) ??
      false
    );
  }

  /**
   * Removes a specific component by component id.
   * Returns the removed instance, or undefined if not found.
   *
   * Emits ENGINE_ENTITY_COMPONENT_REMOVED_EVENT with the removed instance.
   *
   * @param {string} entityId The ID of the entity to remove the component from.
   * @param {string} componentId The ID of the component to remove.
   * @returns {Component | undefined} The removed component instance if found and removed, or undefined if not found.
   */
  remove(entityId: string, componentId: string): Component | undefined {
    const list = this.components.get(entityId);
    if (!list) return undefined;

    const index = list.findIndex((c) => c.id === componentId);
    if (index === -1) return undefined;

    const [removed] = list.splice(index, 1);
    if (list.length === 0) {
      this.components.delete(entityId);
    }

    return removed;
  }

  /**
   * Removes all components from an entity.
   * Returns the removed instances (used to emit individual removed events).
   *
   * Emits ENGINE_ENTITY_COMPONENT_REMOVED_EVENT for each removed instance.
   *
   * @param {string} entityId The ID of the entity to remove all components from.
   * @returns {Component[]} An array of the removed component instances, or an empty array if the entity had no components.
   */
  removeAll(entityId: string): Component[] {
    const list = this.components.get(entityId) ?? [];
    this.components.delete(entityId);
    return list;
  }
}
