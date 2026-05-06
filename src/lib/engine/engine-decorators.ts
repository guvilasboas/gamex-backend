// ─── Component ───────────────────────────────────────────────────────────────
export {
  ComponentType,
  GetComponentType,
} from './engine-entities/engine-entities-components/component-type.decorator';

// ─── Entity ───────────────────────────────────────────────────────────────────
export {
  EntityDef,
  GetEntityType,
} from './engine-entities/entity-def.decorator';
export {
  WithComponent,
  GetWithComponentDefs,
} from './engine-entities/with-component.decorator';

// ─── Game loop ────────────────────────────────────────────────────────────────
export {
  OnBeforeUpdate,
  OnUpdate,
  OnAfterUpdate,
  OnBeforeRender,
  OnRender,
  OnAfterRender,
} from './engine-loop.decorators';

// ─── Entity events ────────────────────────────────────────────────────────────
export {
  OnEntityCreated,
  OnEntityDeleted,
} from './engine-entities/entity-event.decorators';
export type { EntityEventFilter } from './engine-entities/entity-event.decorators';

// ─── Collision events ─────────────────────────────────────────────────────────
export {
  OnCollisionEnter,
  OnCollisionStay,
  OnCollisionExit,
} from './engine-collisions/collision-event.decorators';
export type { CollisionEventFilter } from './engine-collisions/collision-event.decorators';

// ─── Serialisation ────────────────────────────────────────────────────────────
export { Sync, GetSyncFields } from './engine-commons/sync.decorator';
