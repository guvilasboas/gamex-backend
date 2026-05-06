import { Container } from '../../../../common/container';
import { EngineEntitiesComponentsManager } from './engine-entities-components.manager';
import { Component } from './component';
import { ComponentFactory } from './component-factory';

// ─── Core management ─────────────────────────────────────────────────────────

/**
 * Adds a component to an entity.
 * Multiple components of the same type are allowed — each is distinguished
 * by its unique `id`. If a component with the same `id` already exists on
 * the entity, it is replaced.
 *
 * @example
 * AddComponent(entity.id, ComponentFactory.create(StatusEffectComponent, { id: 'burn', duration: 5 }));
 * AddComponent(entity.id, ComponentFactory.create(StatusEffectComponent, { id: 'slow', duration: 3 }));
 */
export function AddComponent<T extends Component>(
  entityId: string,
  component: T,
): T {
  const manager = Container.get<EngineEntitiesComponentsManager>(
    EngineEntitiesComponentsManager,
  );
  component.entityId = entityId;
  manager.add(component);
  return component;
}

/**
 * Returns a specific component by entity id + component id.
 *
 * @example
 * const burn = GetComponent(entity.id, 'burn');
 */
export function GetComponent(
  entityId: string,
  componentId: string,
): Component | undefined {
  const manager = Container.get<EngineEntitiesComponentsManager>(
    EngineEntitiesComponentsManager,
  );
  return manager.get(entityId, componentId);
}

/**
 * Returns all component instances of a given type on an entity.
 * Returns an empty array if none exist.
 *
 * @example
 * const effects = GetComponentsByType(entity.id, StatusEffectComponent);
 */
export function GetComponentsByType<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
): T[] {
  const manager = Container.get<EngineEntitiesComponentsManager>(
    EngineEntitiesComponentsManager,
  );
  return manager.getByType(entityId, componentClass);
}

/**
 * Returns all components on an entity.
 */
export function GetAllComponents(entityId: string): Component[] {
  const manager = Container.get<EngineEntitiesComponentsManager>(
    EngineEntitiesComponentsManager,
  );
  return manager.getAll(entityId);
}

/**
 * Returns true if the entity has at least one component of the given type.
 *
 * @example
 * if (HasComponent(entity.id, HealthComponent)) { ... }
 */
export function HasComponent<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
): boolean {
  const manager = Container.get<EngineEntitiesComponentsManager>(
    EngineEntitiesComponentsManager,
  );
  return manager.has(entityId, componentClass);
}

/**
 * Removes a specific component by component id.
 * No-op if the component does not exist.
 */
export function RemoveComponent(entityId: string, componentId: string): void {
  const manager = Container.get<EngineEntitiesComponentsManager>(
    EngineEntitiesComponentsManager,
  );
  manager.remove(entityId, componentId);
}

// ─── Convenience shortcuts ────────────────────────────────────────────────────

/**
 * Creates and immediately adds a component to an entity in one call.
 * Equivalent to: AddComponent(entityId, ComponentFactory.create(Class, params))
 *
 * @example
 * AttachComponent(entity.id, HealthComponent, { id: 'health', current: 100, max: 100 });
 */
export function AttachComponent<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
  params: Partial<T> & { id: string },
): T {
  const component = ComponentFactory.create(componentClass, params);

  return AddComponent(entityId, component);
}

/**
 * Updates fields on an existing component and re-registers it
 * (emitting ENGINE_ENTITY_COMPONENT_UPDATED_EVENT).
 * No-op if the component does not exist.
 *
 * @example
 * PatchComponent(entity.id, 'health', { current: health.current - 10 });
 */
export function PatchComponent(
  entityId: string,
  componentId: string,
  changes: Record<string, unknown>,
): void {
  const manager = Container.get<EngineEntitiesComponentsManager>(
    EngineEntitiesComponentsManager,
  );
  const existing = manager.get(entityId, componentId);
  if (!existing) return;
  Object.assign(existing, changes);
  manager.add(existing);
}
