/**
 * Emitted when a component is added to an entity.
 * Payload: Component
 */
export const ENGINE_ENTITY_COMPONENT_ADDED_EVENT =
  'engine.entity.component.added';

/**
 * Emitted when an existing component is replaced (same entityId + id).
 * Payload: { previous: Component; next: Component }
 */
export const ENGINE_ENTITY_COMPONENT_UPDATED_EVENT =
  'engine.entity.component.updated';

/**
 * Emitted when a specific component is removed from an entity.
 * Payload: Component (the removed instance)
 */
export const ENGINE_ENTITY_COMPONENT_REMOVED_EVENT =
  'engine.entity.component.removed';
