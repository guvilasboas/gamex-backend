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
   */
  private readonly components: Map<string, Component[]> = new Map();

  /**
   * Adds a component to an entity.
   * If a component with the same `id` already exists on the entity, it is
   * replaced. Otherwise the component is appended to the entity's list.
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
   */
  get(entityId: string, componentId: string): Component | undefined {
    return this.components.get(entityId)?.find((c) => c.id === componentId);
  }

  /**
   * Returns all component instances of a given type on an entity.
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
   */
  getAll(entityId: string): Component[] {
    return this.components.get(entityId) ?? [];
  }

  /**
   * Returns true if the entity has at least one component of the given type.
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
   */
  removeAll(entityId: string): Component[] {
    const list = this.components.get(entityId) ?? [];
    this.components.delete(entityId);
    return list;
  }
}
