# Engine State Machine V2

## Objective

This document proposes a second version of the engine finite state machine subsystem, revised to fit the architecture that already exists in the codebase.

The main change from the previous proposal is structural:

- state machine instances remain ordinary engine components
- runtime state lives on the component
- machine definitions live outside the component as static metadata
- transitions are coordinated by a manager, not by a dedicated runtime registry

This keeps the subsystem aligned with the current engine model, where:

- entities are stored in `EngineEntitiesRegistry`
- components are stored in `EngineEntitiesComponentsRegistry`
- component lifecycle is already managed by `EngineEntitiesComponentsManager`
- systems react through `EventEmitter2` and engine loop decorators

---

## Why V1 Should Change

The first proposal is solid at the API level, but it introduces a few architectural mismatches with the current engine:

1. It creates a second runtime registry for something that is already a component.

The current engine already has a canonical storage layer for entity-owned runtime data: `EngineEntitiesComponentsRegistry` plus `EngineEntitiesComponentsManager`. A dedicated `EngineStateMachineRegistry` would duplicate ownership, lookup and deletion semantics.

2. It stores the full machine definition inside each component instance.

That works for simple cases, but it becomes expensive and awkward when definitions contain guard functions, action functions, or richer transition metadata. Definitions are behavior metadata, not per-entity runtime state.

3. It adds entity cleanup logic inside the state machine subsystem that the component subsystem already handles.

`EngineEntitiesComponentsSystem` already removes all components when an entity is deleted. The FSM subsystem should compose with that lifecycle, not reimplement it.

4. Its decorator filtering model is incomplete for entity type filtering.

The proposal exposes `entityType` in the decorator filter, but its event payload only carries `entityId`. Without either the entity instance or precomputed entity metadata in the payload, the decorator cannot evaluate that filter locally.

5. It couples transition rules and per-entity state too tightly.

When the same machine definition is used by many entities, embedding the definition in every component makes replacement, versioning, debugging, and migration harder than necessary.

---

## Design Principles

V2 follows these rules:

1. A state machine instance is still just a component attached to an entity.
2. The component stores only mutable runtime state.
3. The immutable machine definition is registered once and resolved by key.
4. The manager is responsible for transition validation and event emission.
5. Entity deletion and component removal continue to flow through the existing component lifecycle.
6. Decorators filter against event payloads that already contain enough data to decide locally.

---

## Proposed Folder Structure

```text
src/lib/engine/engine-state-machine/
├── index.ts
├── state-machine.component.ts
├── engine-state-machine.types.ts
├── engine-state-machine.events.ts
├── engine-state-machine-definitions.registry.ts
├── engine-state-machine.manager.ts
├── engine-state-machine.sdk.ts
├── engine-state-machine.system.ts
├── engine-state-machine.module.ts
└── on-state.decorators.ts
```

Compared to V1:

- keep a definitions registry
- remove the per-instance runtime registry
- keep manager, system, sdk, decorators and module

---

## High-Level Architecture

### 1. Runtime component

Each entity owns one or more `StateMachineComponent` instances.

The component stores:

- component id, such as `movement`
- definition key, such as `player.movement`
- current state
- previous state
- state entered tick
- mutable context

It does not store the full definition graph.

### 2. Definition registry

The FSM definition graph is registered once in a global registry keyed by a stable string.

Examples:

- `player.movement`
- `player.combat`
- `npc.patrol`

This registry is not runtime entity state. It is engine metadata, similar in spirit to how decorators and class metadata are used elsewhere.

### 3. Manager

The manager resolves the component and its definition, validates transitions, mutates runtime state, and emits enter/exit/update events.

### 4. System

The system drives per-tick state updates and listens to component removal so the subsystem can emit a final exit event when a machine disappears.

### 5. SDK

The SDK provides the functional API expected by gameplay systems.

---

## Core Types

```typescript
export type StateId = string;
export type StateMachineDefinitionId = string;
export type TransitionId = string;

export type TransitionGuardContext<TContext = unknown> = {
  entity: Entity;
  machine: StateMachineComponent<TContext>;
  context: TContext;
};

export type TransitionGuard<TContext = unknown> = (
  args: TransitionGuardContext<TContext>,
) => boolean;

export type StateTransition<TContext = unknown> = {
  to: StateId;
  guard?: TransitionGuard<TContext>;
};

export type StateDefinition<TContext = unknown> = {
  id: StateId;
  transitions?: Record<TransitionId, StateTransition<TContext>>;
};

export type StateMachineDefinition<TContext = unknown> = {
  id: StateMachineDefinitionId;
  initialState: StateId;
  states: Record<StateId, StateDefinition<TContext>>;
};
```

### Why `states` should be a record in V2

V1 uses an array of states. V2 should use `Record<StateId, StateDefinition>` because the runtime path is lookup-heavy, not iteration-heavy.

That gives direct access during transitions:

```typescript
const state = definition.states[machine.currentState];
```

instead of:

```typescript
const state = definition.states.find((item) => item.id === machine.currentState);
```

This is simpler, cheaper, and easier to validate at registration time.

---

## Runtime Component

```typescript
@ComponentType('state-machine')
export class StateMachineComponent<TContext = unknown> extends Component {
  static readonly type = 'state-machine';

  /** Stable key of the immutable machine definition */
  definitionId: StateMachineDefinitionId;

  /** Current active state */
  currentState: StateId;

  /** Previous state, if any */
  previousState?: StateId;

  /** Tick when the current state was entered */
  stateEnteredAt = 0;

  /** Mutable runtime bag used by guards and systems */
  context: TContext;
}
```

### Why remove derived methods from the component

In V1, helper methods like `canTransition()` and `getTargetState()` live on the component and depend on the embedded definition.

In V2, those checks should move into the manager because:

- the definition no longer lives on the component
- transition validation is domain logic, not plain data shape
- manager-level validation is easier to instrument and test

---

## Definitions Registry

This is the one registry V2 still needs.

Its job is narrow:

- register immutable machine definitions
- return definitions by id
- fail fast on duplicate or invalid registrations

```typescript
@Injectable()
export class EngineStateMachineDefinitionsRegistry {
  private readonly definitions = new Map<
    StateMachineDefinitionId,
    StateMachineDefinition<any>
  >();

  register<TContext>(definition: StateMachineDefinition<TContext>): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`State machine definition already registered: ${definition.id}`);
    }

    this.validateDefinition(definition);
    this.definitions.set(definition.id, definition);
  }

  get<TContext>(id: StateMachineDefinitionId): StateMachineDefinition<TContext> | undefined {
    return this.definitions.get(id) as StateMachineDefinition<TContext> | undefined;
  }

  private validateDefinition<TContext>(definition: StateMachineDefinition<TContext>): void {
    if (!definition.states[definition.initialState]) {
      throw new Error(`Initial state not found in definition: ${definition.id}`);
    }

    for (const state of Object.values(definition.states)) {
      for (const transition of Object.values(state.transitions ?? {})) {
        if (!definition.states[transition.to]) {
          throw new Error(
            `Transition target \"${transition.to}\" not found in definition: ${definition.id}`,
          );
        }
      }
    }
  }
}
```

### Why this registry is justified

This registry does not duplicate runtime ownership. It stores shared metadata. That is materially different from V1, where the extra registry stored per-entity runtime instances that already belong in the component subsystem.

---

## Events

```typescript
export const ENGINE_SM_ENTER_EVENT = 'engine.stateMachine.enter';
export const ENGINE_SM_EXIT_EVENT = 'engine.stateMachine.exit';
export const ENGINE_SM_UPDATE_EVENT = 'engine.stateMachine.update';
export const ENGINE_SM_TRANSITION_BLOCKED_EVENT = 'engine.stateMachine.blocked';
```

### Payloads

```typescript
export type StateMachineEventEntitySnapshot = {
  id: string;
  type?: string;
  tags: string[];
};

export type StateMachineTransitionPayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machineId: string;
  definitionId: StateMachineDefinitionId;
  from?: StateId;
  to: StateId;
  transitionId?: TransitionId;
  context: TContext;
  tick: number;
};

export type StateMachineBlockedPayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machineId: string;
  definitionId: StateMachineDefinitionId;
  currentState: StateId;
  transitionId: TransitionId;
  reason: 'missing-transition' | 'guard-blocked' | 'missing-definition';
  context: TContext;
  tick: number;
};

export type StateMachineUpdatePayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machineId: string;
  definitionId: StateMachineDefinitionId;
  currentState: StateId;
  context: TContext;
  tick: number;
  deltaMs: number;
};
```

### Why V2 should emit entity metadata

This is what enables decorator filters like `entityType` and `entityTag` without forcing decorators to reach into Nest DI or global singletons.

It also makes logs and debug tooling more useful.

### Why add a blocked transition event

Silent transition failure is convenient for gameplay code, but poor for diagnosis. A blocked event makes it possible to debug invalid transitions without forcing exceptions into normal game flow.

---

## Manager

The manager should depend on:

- `EngineEntitiesRegistry`
- `EngineEntitiesComponentsManager`
- `EngineStateMachineDefinitionsRegistry`
- `EventEmitter2`

It should not own a runtime store.

### Responsibilities

1. Create and attach a state machine component.
2. Resolve the registered definition.
3. Validate transitions.
4. Update `currentState`, `previousState`, `stateEnteredAt`, and `context`.
5. Emit enter, exit, update, and blocked events.
6. Provide typed accessors for gameplay systems.

### Suggested API

```typescript
@Injectable()
export class EngineStateMachineManager {
  constructor(
    private readonly entitiesRegistry: EngineEntitiesRegistry,
    private readonly componentsManager: EngineEntitiesComponentsManager,
    private readonly definitionsRegistry: EngineStateMachineDefinitionsRegistry,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  create<TContext>(
    entityId: string,
    definitionId: StateMachineDefinitionId,
    params: { id: string; context?: TContext },
    tick: number,
  ): StateMachineComponent<TContext>;

  transition(
    entityId: string,
    machineId: string,
    transitionId: TransitionId,
    tick: number,
  ): boolean;

  forceState(
    entityId: string,
    machineId: string,
    nextState: StateId,
    tick: number,
  ): boolean;

  get<TContext = unknown>(
    entityId: string,
    machineId: string,
  ): StateMachineComponent<TContext> | undefined;

  getDefinition<TContext = unknown>(
    definitionId: StateMachineDefinitionId,
  ): StateMachineDefinition<TContext> | undefined;

  patchContext<TContext>(
    entityId: string,
    machineId: string,
    patch: Partial<TContext>,
  ): boolean;

  tick(entityId: string, tick: number, deltaMs: number): void;
}
```

### Suggested transition flow

```typescript
transition(entityId, machineId, transitionId, tick): boolean {
  const entity = this.entitiesRegistry.get(entityId);
  const machine = this.get(entityId, machineId);
  if (!entity || !machine) return false;

  const definition = this.definitionsRegistry.get(machine.definitionId);
  if (!definition) {
    this.emitBlocked(entity, machine, transitionId, 'missing-definition', tick);
    return false;
  }

  const currentState = definition.states[machine.currentState];
  const transition = currentState?.transitions?.[transitionId];
  if (!transition) {
    this.emitBlocked(entity, machine, transitionId, 'missing-transition', tick);
    return false;
  }

  if (transition.guard && !transition.guard({
    entity,
    machine,
    context: machine.context,
  })) {
    this.emitBlocked(entity, machine, transitionId, 'guard-blocked', tick);
    return false;
  }

  const previousState = machine.currentState;
  const nextState = transition.to;

  this.emitExit(entity, machine, previousState, nextState, transitionId, tick);

  machine.previousState = previousState;
  machine.currentState = nextState;
  machine.stateEnteredAt = tick;

  this.emitEnter(entity, machine, previousState, nextState, transitionId, tick);
  return true;
}
```

---

## System

The system should handle two responsibilities.

### 1. Per-tick update emission

Like V1, it should emit state update events during the game loop.

Because the component registry is entity-scoped, the simplest implementation is still to iterate entities and then retrieve `StateMachineComponent` instances from the component manager.

```typescript
@Injectable()
export class EngineStateMachineSystem {
  constructor(
    private readonly entitiesRegistry: EngineEntitiesRegistry,
    private readonly componentsManager: EngineEntitiesComponentsManager,
    private readonly manager: EngineStateMachineManager,
  ) {}

  @OnUpdate()
  onUpdate(event: EngineStepEvent): void {
    for (const entity of this.entitiesRegistry.getAll()) {
      const machines = this.componentsManager.getByType(
        entity.id,
        StateMachineComponent,
      );

      for (const machine of machines) {
        this.manager.tick(entity.id, event.tick, event.deltaMs);
      }
    }
  }
}
```

Implementation note: in code, this should be optimized to call a `tickEntity()` style method once per entity, not once per machine. The example above shows component ownership, not the exact final loop shape.

### 2. Exit-on-removal lifecycle

When a state machine component is removed, the subsystem should emit a final exit event for observability.

This should happen by listening to the existing component removal event, not by building another entity cleanup path.

```typescript
@OnEvent(ENGINE_ENTITY_COMPONENT_REMOVED_EVENT)
onComponentRemoved(component: Component): void {
  if (!(component instanceof StateMachineComponent)) return;
  this.manager.handleRemovedMachine(component);
}
```

This is the critical architectural difference versus V1: entity deletion already removes components centrally, so the FSM subsystem should hook into that removal stream instead of owning its own removal registry.

---

## SDK

The public functional API should remain close to the original proposal, but should expose definition registration explicitly.

```typescript
export function RegisterStateMachine<TContext>(
  definition: StateMachineDefinition<TContext>,
): void;

export function CreateStateMachine<TContext>(
  entityId: string,
  definitionId: StateMachineDefinitionId,
  params: { id: string; context?: TContext },
): StateMachineComponent<TContext>;

export function Transition(
  entityId: string,
  machineId: string,
  transitionId: TransitionId,
): boolean;

export function ForceState(
  entityId: string,
  machineId: string,
  nextState: StateId,
): boolean;

export function GetStateMachine<TContext = unknown>(
  entityId: string,
  machineId: string,
): StateMachineComponent<TContext> | undefined;

export function GetCurrentState(
  entityId: string,
  machineId: string,
): StateId | undefined;

export function PatchStateMachineContext<TContext>(
  entityId: string,
  machineId: string,
  patch: Partial<TContext>,
): boolean;
```

### Why registration belongs in the SDK

It makes definition ownership explicit and avoids hidden side effects in module constructors or system boot order.

If the project later wants decorator-based definition registration, it can be added on top of the same registry.

---

## Decorators

The decorator model from V1 is worth keeping, but the filters should match what the payload can actually provide.

```typescript
export type StateEventFilter = {
  machineId?: string;
  definitionId?: StateMachineDefinitionId;
  state?: StateId;
  entityType?: string;
  entityTag?: string;
};
```

```typescript
function makeStateDecorator(eventName: string) {
  return (filter?: StateEventFilter): MethodDecorator =>
    (target, propertyKey, descriptor: PropertyDescriptor) => {
      if (filter) {
        const original = descriptor.value;
        descriptor.value = function (
          payload: StateMachineTransitionPayload | StateMachineUpdatePayload,
        ) {
          if (filter.machineId && payload.machineId !== filter.machineId) return;
          if (filter.definitionId && payload.definitionId !== filter.definitionId) return;

          const activeState = 'to' in payload ? payload.to : payload.currentState;
          if (filter.state && activeState !== filter.state) return;

          if (filter.entityType && payload.entity.type !== filter.entityType) return;
          if (filter.entityTag && !payload.entity.tags.includes(filter.entityTag)) return;

          return original.call(this, payload);
        };
      }

      OnEvent(eventName)(target, propertyKey, descriptor);
    };
}
```

This keeps decorators lightweight and consistent with the current event-filtering style used by collision and entity decorators.

---

## Module

```typescript
@Global()
@Module({
  providers: [
    EngineStateMachineDefinitionsRegistry,
    EngineStateMachineManager,
    EngineStateMachineSystem,
  ],
  exports: [
    EngineStateMachineDefinitionsRegistry,
    EngineStateMachineManager,
  ],
})
export class EngineStateMachineModule {}
```

And then in `EngineModule`:

```typescript
imports: [
  EngineCollisionsModule,
  EngineEntitiesModule,
  EngineSessionsModule,
  EngineChunksModule,
  EngineDebugModule,
  EngineStoreModule,
  EngineStateMachineModule,
],
```

---

## Recommended Runtime Flow

### Boot time

1. Gameplay code registers immutable machine definitions.
2. `EngineStateMachineDefinitionsRegistry` validates them once.

### Entity creation time

1. Gameplay code creates an entity.
2. Gameplay code creates one or more state machine components bound to definition ids.
3. The manager sets the initial state and emits an initial enter event.

### Gameplay time

1. Systems call `Transition()`.
2. The manager resolves the machine definition.
3. The manager validates transition existence and guard result.
4. The manager emits exit and enter events around the mutation.

### Entity deletion time

1. Entity deletion triggers `EngineEntitiesComponentsSystem`.
2. Components are removed centrally.
3. The FSM system observes removed `StateMachineComponent` instances and emits a final exit event if needed.

---

## Example

### Definition

```typescript
export const PlayerState = {
  IDLE: 'idle',
  RUNNING: 'running',
  JUMPING: 'jumping',
  ATTACKING: 'attacking',
  DEAD: 'dead',
} as const;

export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

export type PlayerMovementContext = {
  hasAirAttack: boolean;
};

export const playerMovementStateMachine: StateMachineDefinition<PlayerMovementContext> = {
  id: 'player.movement',
  initialState: PlayerState.IDLE,
  states: {
    [PlayerState.IDLE]: {
      id: PlayerState.IDLE,
      transitions: {
        move: { to: PlayerState.RUNNING },
        jump: { to: PlayerState.JUMPING },
        attack: { to: PlayerState.ATTACKING },
        die: { to: PlayerState.DEAD },
      },
    },
    [PlayerState.RUNNING]: {
      id: PlayerState.RUNNING,
      transitions: {
        stop: { to: PlayerState.IDLE },
        jump: { to: PlayerState.JUMPING },
        attack: { to: PlayerState.ATTACKING },
        die: { to: PlayerState.DEAD },
      },
    },
    [PlayerState.JUMPING]: {
      id: PlayerState.JUMPING,
      transitions: {
        land: { to: PlayerState.IDLE },
        die: { to: PlayerState.DEAD },
        attack: {
          to: PlayerState.ATTACKING,
          guard: ({ context }) => context.hasAirAttack,
        },
      },
    },
    [PlayerState.ATTACKING]: {
      id: PlayerState.ATTACKING,
      transitions: {
        finish: { to: PlayerState.IDLE },
        die: { to: PlayerState.DEAD },
      },
    },
    [PlayerState.DEAD]: {
      id: PlayerState.DEAD,
      transitions: {
        respawn: { to: PlayerState.IDLE },
      },
    },
  },
};
```

### Registration

```typescript
RegisterStateMachine(playerMovementStateMachine);
```

### Attach to entity

```typescript
CreateStateMachine<PlayerMovementContext>(player.id, 'player.movement', {
  id: 'movement',
  context: { hasAirAttack: false },
});
```

### Use in systems

```typescript
@OnAction('move')
onMove({ sessionId }: DispatchedSessionAction<MoveAction>): void {
  const player = GetPlayerBySession(sessionId);
  if (!player) return;

  Transition(player.id, 'movement', 'move');
}

@OnCollisionEnter({ colliderTag: 'hazard', side: 'b' })
onHazardHit(manifold: CollisionManifold): void {
  Transition(manifold.entityAId, 'movement', 'die');
}
```

### React to states

```typescript
@OnStateEnter({ machineId: 'movement', state: PlayerState.RUNNING })
onRunning({ entity }: StateMachineTransitionPayload): void {
  AttachComponent(entity.id, AnimationComponent, {
    id: 'anim',
    clip: 'run',
    loop: true,
  });
}

@OnStateUpdate({ machineId: 'movement', state: PlayerState.ATTACKING })
onAttackTick({ entity, tick }: StateMachineUpdatePayload): void {
  const sm = GetStateMachine(entity.id, 'movement');
  if (sm && tick - sm.stateEnteredAt >= 30) {
    Transition(entity.id, 'movement', 'finish');
  }
}
```

---

## Comparison With V1

| Topic | V1 | V2 |
|---|---|---|
| Runtime storage | Dedicated FSM registry | Existing component registry |
| Definition storage | Embedded in each component | Shared global definitions registry |
| Cleanup | FSM-specific `removeAll` path | Existing component removal lifecycle |
| Decorator filtering | Limited by payload shape | Entity metadata included in payload |
| Transition diagnostics | Silent false returns | Optional blocked event |
| Definition lookup | Linear state array search | Constant-time record lookup |

---

## Recommended Implementation Order

1. Add `engine-state-machine` module with types, component, events, definitions registry, manager, system, sdk and decorators.
2. Register the module inside `EngineModule`.
3. Implement definition validation.
4. Implement manager create and transition flow.
5. Implement system update emission and removal handling.
6. Add focused tests for:
   - initial state enter event
   - valid transition
   - blocked transition by missing edge
   - blocked transition by guard
   - forced transition
   - removal finalization

---

## Final Recommendation

If this subsystem is implemented now, V2 is the better fit for the current engine.

The main reason is not API style. It is ownership.

The engine already has a clear ownership model for runtime entity data through the component subsystem. The FSM design should reuse that model and add only one new concept that the engine does not yet have: a registry for immutable machine definitions.

That yields a smaller subsystem, less duplicated lifecycle logic, cleaner serialization boundaries, and a better path for future features such as debug tooling, machine versioning, hierarchical states, or visual inspectors.