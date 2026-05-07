# Engine State Machine V3

## Objective

This document proposes a third version of the finite state machine subsystem for the engine.

V3 keeps the main architectural correction introduced in V2:

- machine instances are regular components
- definitions are shared immutable metadata
- component lifecycle remains the source of truth for ownership

But it adds a second layer of improvements aimed at real implementation concerns that V2 still leaves open:

1. deterministic transition semantics under synchronous event emission
2. optional runtime indexing for active machines without reintroducing ownership duplication
3. clearer separation between serializable runtime state and executable behavior metadata
4. better support for debugging, observability and future tooling

The result is a design that is still simple to implement in the current engine, but is more stable once gameplay code starts chaining transitions from collisions, actions and state callbacks.

---

## Evolution Summary

### V1 to V2

V2 corrected the largest architectural mismatch in V1:

- removed the dedicated runtime registry as the source of truth
- reused the existing component lifecycle
- moved definitions out of runtime instances
- improved event payloads for filtering and observability

### V2 to V3

V3 addresses the next layer of problems:

- avoids reentrant transitions during enter and exit handlers
- avoids scanning every entity every tick when that becomes expensive
- defines a stable transition result model instead of only boolean success or failure
- formalizes serializable machine snapshots for store sync and debugging
- adds lifecycle semantics for suspension, resumption and finalization

---

## Design Goals

V3 follows these goals:

1. runtime ownership must stay in the entity component subsystem
2. state machine definitions must remain immutable shared metadata
3. transition evaluation must be deterministic within a tick
4. event handlers must not be able to corrupt machine state through reentrant mutation
5. performance optimizations must be additive indexes, not parallel ownership stores
6. runtime machine state must remain serializable
7. side effects should stay in systems and decorators, not inside definition data

---

## Why V3 Is Needed

V2 is already a good architecture, but there are still four practical gaps.

### 1. Reentrancy is still underspecified

In V2, a transition emits exit and enter events immediately. If one of those handlers calls `Transition()` again, nested transitions can happen while the first transition is still on the stack.

That creates hard-to-reason-about behavior such as:

- multiple enter and exit chains in the same call stack
- state snapshots that depend on handler order
- logic that behaves differently when a listener is added or removed

V3 solves this by introducing transition intents and a controlled flush phase.

### 2. Per-tick iteration is correct but not scalable

V2 suggests iterating all entities and then querying state machine components. That is acceptable initially, but it makes the update path depend on total entity count, not on active machine count.

V3 adds a derived active-machine index maintained from component lifecycle events. This is an optimization index, not an ownership registry.

### 3. Boolean transition results are too weak

Returning only `true` or `false` loses valuable information about why a transition failed.

V3 introduces explicit transition result codes.

### 4. Serialization and tooling need a stable runtime snapshot shape

Definitions can contain functions. Runtime state cannot. V2 already separates them conceptually, but V3 makes snapshot boundaries explicit to support store sync, debug views and future inspectors.

---

## Core Architecture

V3 splits the subsystem into four layers.

### 1. Definition layer

Immutable machine definitions registered once.

### 2. Runtime component layer

Per-entity mutable machine instances stored as regular components.

### 3. Coordination layer

Manager plus transition queue responsible for validating and applying transitions deterministically.

### 4. Derived index layer

Optional runtime index of active state machines used for efficient ticking and debugging. This layer is derived from component events and can be rebuilt from source-of-truth component state.

---

## Proposed Folder Structure

```text
src/lib/engine/engine-state-machine/
├── index.ts
├── state-machine.component.ts
├── engine-state-machine.types.ts
├── engine-state-machine.events.ts
├── engine-state-machine-definitions.registry.ts
├── engine-state-machine-active.index.ts
├── engine-state-machine.transition-queue.ts
├── engine-state-machine.manager.ts
├── engine-state-machine.sdk.ts
├── engine-state-machine.system.ts
├── engine-state-machine.module.ts
└── on-state.decorators.ts
```

New compared to V2:

- `engine-state-machine-active.index.ts`
- `engine-state-machine.transition-queue.ts`

---

## Runtime Model

### Component

The runtime component remains the entity-owned mutable object.

```typescript
@ComponentType('state-machine')
export class StateMachineComponent<TContext = unknown> extends Component {
  static readonly type = 'state-machine';

  definitionId: StateMachineDefinitionId;
  currentState: StateId;
  previousState?: StateId;
  stateEnteredAt = 0;
  context: TContext;

  /** Machine does not receive updates while suspended */
  suspended = false;

  /** Monotonic counter incremented on each applied transition */
  revision = 0;
}
```

### Why add `suspended`

Some machines should temporarily stop updating without being removed, for example:

- cutscenes
- stunned or frozen gameplay layers
- disconnected players whose entity remains alive

This is cheaper and semantically cleaner than removing and re-adding the component.

### Why add `revision`

A monotonic runtime revision helps:

- debug tools detect stale snapshots
- queued intents verify they are still valid if needed
- future optimistic flows become possible without redesigning the component

---

## Definition Model

Definitions remain immutable and shared.

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

### Constraint: definitions should stay declarative

V3 keeps guards in the definition because they are pure decision logic. But it explicitly does not embed side effects like `onEnter`, `onExit` or `onUpdate` functions into the definition.

Those should stay in systems through decorators because:

- they fit the engine event model better
- they keep definitions closer to serializable data
- they avoid hidden behavior spread across metadata and systems

---

## Ownership and Indexing

### Source of truth

The source of truth remains:

- `EngineEntitiesRegistry` for entities
- `EngineEntitiesComponentsRegistry` for runtime machine instances

### Derived active index

V3 adds an optional index for runtime efficiency.

```typescript
@Injectable()
export class EngineStateMachineActiveIndex {
  private readonly machineKeys = new Set<string>();

  makeKey(entityId: string, machineId: string): string {
    return `${entityId}::${machineId}`;
  }

  add(entityId: string, machineId: string): void {
    this.machineKeys.add(this.makeKey(entityId, machineId));
  }

  remove(entityId: string, machineId: string): void {
    this.machineKeys.delete(this.makeKey(entityId, machineId));
  }

  getAll(): Array<{ entityId: string; machineId: string }> {
    return Array.from(this.machineKeys, (key) => {
      const [entityId, machineId] = key.split('::');
      return { entityId, machineId };
    });
  }
}
```

### Why this is not the V1 problem again

This index does not own runtime state.

It can always be rebuilt from component add and remove events. It exists only to reduce the cost of ticking and inspection. If it disappears, the machine state is still correct because the component registry remains authoritative.

---

## Deterministic Transition Semantics

This is the main V3 improvement.

### Transition intents instead of direct nested mutation

Gameplay code still calls `Transition(entityId, machineId, transitionId)`, but internally the manager should enqueue a transition intent and resolve it through a controlled flush.

This gives deterministic rules:

1. the manager may apply multiple transitions in one tick
2. transitions are processed sequentially in FIFO order
3. a listener may request another transition during an enter or exit event
4. that new request is appended to the queue instead of mutating state reentrantly
5. the current transition fully completes before the next begins

### Transition queue

```typescript
export type StateMachineTransitionIntent = {
  entityId: string;
  machineId: string;
  transitionId: TransitionId;
  tick: number;
};
```

```typescript
@Injectable()
export class EngineStateMachineTransitionQueue {
  private readonly items: StateMachineTransitionIntent[] = [];

  enqueue(intent: StateMachineTransitionIntent): void {
    this.items.push(intent);
  }

  dequeue(): StateMachineTransitionIntent | undefined {
    return this.items.shift();
  }

  get size(): number {
    return this.items.length;
  }
}
```

### Manager flush contract

The manager should guard against recursive flushing.

```typescript
private flushing = false;

requestTransition(entityId, machineId, transitionId, tick): TransitionRequestResult {
  this.queue.enqueue({ entityId, machineId, transitionId, tick });
  this.flush();
  return { accepted: true };
}

private flush(): void {
  if (this.flushing) return;
  this.flushing = true;

  try {
    while (this.queue.size > 0) {
      const intent = this.queue.dequeue()!;
      this.applyTransition(intent);
    }
  } finally {
    this.flushing = false;
  }
}
```

This gives predictable sequencing without requiring async code, external schedulers or broad engine changes.

---

## Transition Result Model

V3 replaces raw boolean outcomes with a structured result.

```typescript
export type TransitionApplyResultCode =
  | 'applied'
  | 'queued'
  | 'missing-entity'
  | 'missing-machine'
  | 'missing-definition'
  | 'missing-state'
  | 'missing-transition'
  | 'guard-blocked'
  | 'suspended';

export type TransitionApplyResult = {
  code: TransitionApplyResultCode;
  entityId: string;
  machineId: string;
  transitionId: TransitionId;
  from?: StateId;
  to?: StateId;
};
```

### Why this matters

This keeps gameplay code simple while making diagnostics much better.

`queued` is important in the non-reentrant model. When `RequestTransition()` is called from inside an enter or exit listener while the manager is already flushing transitions, the new intent is accepted immediately but will only be applied after the current transition completes.

The SDK may still offer a convenience boolean API:

```typescript
export function Transition(...args): boolean {
  return ['applied', 'queued'].includes(RequestTransition(...args).code);
}
```

But the manager and debug tooling should work with the full result object.

---

## Events

V3 keeps the V2 event payload idea and extends it with lifecycle completeness.

```typescript
export const ENGINE_SM_ENTER_EVENT = 'engine.stateMachine.enter';
export const ENGINE_SM_EXIT_EVENT = 'engine.stateMachine.exit';
export const ENGINE_SM_UPDATE_EVENT = 'engine.stateMachine.update';
export const ENGINE_SM_TRANSITION_BLOCKED_EVENT = 'engine.stateMachine.blocked';
export const ENGINE_SM_SUSPENDED_EVENT = 'engine.stateMachine.suspended';
export const ENGINE_SM_RESUMED_EVENT = 'engine.stateMachine.resumed';
export const ENGINE_SM_FINALIZED_EVENT = 'engine.stateMachine.finalized';
```

### Entity snapshot

```typescript
export type StateMachineEventEntitySnapshot = {
  id: string;
  type?: string;
  tags: string[];
};
```

### Machine snapshot

```typescript
export type StateMachineRuntimeSnapshot<TContext = unknown> = {
  entityId: string;
  machineId: string;
  definitionId: StateMachineDefinitionId;
  currentState: StateId;
  previousState?: StateId;
  stateEnteredAt: number;
  suspended: boolean;
  revision: number;
  context: TContext;
};
```

### Transition payload

```typescript
export type StateMachineTransitionPayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machine: StateMachineRuntimeSnapshot<TContext>;
  from?: StateId;
  to: StateId;
  transitionId?: TransitionId;
  tick: number;
};
```

### Why include full machine snapshot

This improves:

- decorators and listeners that need consistent machine data
- debug panels and logs
- store sync if the project later mirrors machine state externally

And it avoids each listener needing to do an immediate lookup for information already available during the transition.

---

## Manager Responsibilities

The V3 manager depends on:

- `EngineEntitiesRegistry`
- `EngineEntitiesComponentsManager`
- `EngineStateMachineDefinitionsRegistry`
- `EngineStateMachineTransitionQueue`
- `EngineStateMachineActiveIndex`
- `EventEmitter2`

### Responsibilities

1. create and attach machine components
2. enqueue transition requests
3. flush queued transitions deterministically
4. validate definition, state and guard rules
5. emit lifecycle and blocked events
6. patch context safely
7. suspend and resume machines
8. finalize machines removed from component lifecycle
9. emit update events for active non-suspended machines

### Suggested API

```typescript
@Injectable()
export class EngineStateMachineManager {
  create<TContext>(
    entityId: string,
    definitionId: StateMachineDefinitionId,
    params: { id: string; context?: TContext },
    tick: number,
  ): StateMachineComponent<TContext>;

  requestTransition(
    entityId: string,
    machineId: string,
    transitionId: TransitionId,
    tick: number,
  ): TransitionApplyResult;

  forceState(
    entityId: string,
    machineId: string,
    nextState: StateId,
    tick: number,
  ): TransitionApplyResult;

  suspend(entityId: string, machineId: string): boolean;
  resume(entityId: string, machineId: string): boolean;

  get<TContext = unknown>(
    entityId: string,
    machineId: string,
  ): StateMachineComponent<TContext> | undefined;

  patchContext<TContext>(
    entityId: string,
    machineId: string,
    patch: Partial<TContext>,
  ): boolean;

  tickMachine(entityId: string, machineId: string, tick: number, deltaMs: number): void;
  handleRemovedMachine(component: StateMachineComponent): void;
}
```

---

## System Design

The system is simpler in V3 because ticking can use the active index.

```typescript
@Injectable()
export class EngineStateMachineSystem {
  constructor(
    private readonly manager: EngineStateMachineManager,
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
```

### Why this is better than scanning entities

Tick cost now scales with active machine count rather than total entity count. That is usually a better fit for gameplay workloads where many entities may not have machines.

---

## Decorators

The decorator model from V2 should be preserved and extended slightly.

```typescript
export type StateEventFilter = {
  machineId?: string;
  definitionId?: StateMachineDefinitionId;
  state?: StateId;
  entityType?: string;
  entityTag?: string;
  suspended?: boolean;
};
```

The payload already contains enough information to support this without extra lookups.

### Design rule

Decorators should remain filter wrappers around `OnEvent`. They should not attempt to mutate state or own orchestration logic. That keeps them consistent with the current collision and entity event patterns.

---

## SDK

The SDK should expose both simple and explicit APIs.

```typescript
export function RegisterStateMachine<TContext>(
  definition: StateMachineDefinition<TContext>,
): void;

export function CreateStateMachine<TContext>(
  entityId: string,
  definitionId: StateMachineDefinitionId,
  params: { id: string; context?: TContext },
): StateMachineComponent<TContext>;

export function RequestTransition(
  entityId: string,
  machineId: string,
  transitionId: TransitionId,
): TransitionApplyResult;

export function Transition(
  entityId: string,
  machineId: string,
  transitionId: TransitionId,
): boolean;

export function ForceState(
  entityId: string,
  machineId: string,
  nextState: StateId,
): TransitionApplyResult;

export function SuspendStateMachine(entityId: string, machineId: string): boolean;
export function ResumeStateMachine(entityId: string, machineId: string): boolean;

export function GetStateMachine<TContext = unknown>(
  entityId: string,
  machineId: string,
): StateMachineComponent<TContext> | undefined;

export function PatchStateMachineContext<TContext>(
  entityId: string,
  machineId: string,
  patch: Partial<TContext>,
): boolean;
```

### Why expose both `RequestTransition` and `Transition`

Most gameplay code only wants a boolean. Debug, tooling and more complex systems need the explicit result object. Exposing both keeps the call site ergonomic without hiding important execution details from the subsystem.

---

## Serialization Boundary

V3 makes one rule explicit:

- definitions are not serialized as part of component runtime state
- machine runtime snapshots are serializable
- event payloads may include runtime snapshots but never executable definition internals

This avoids accidental leakage of function-bearing objects into store synchronization or transport layers.

---

## Recommended Runtime Flow

### Boot

1. gameplay modules register immutable definitions
2. definitions registry validates structure and targets

### Entity creation

1. gameplay code creates the entity
2. gameplay code creates one or more machine components using definition ids
3. component add event updates the active index
4. manager emits the initial enter event

### Gameplay transition

1. gameplay code requests a transition
2. manager enqueues an intent
3. manager flushes the queue if not already flushing
4. one transition is applied at a time
5. exit and enter events may enqueue more transitions
6. queued transitions are processed after the current transition completes

### Update tick

1. state machine system iterates the active index
2. suspended machines are skipped
3. manager emits state update events for active machines

### Removal

1. component subsystem removes the machine component
2. active index removes the derived reference
3. manager emits a finalized event and optional terminal exit semantics if configured

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

### Usage

```typescript
RegisterStateMachine(playerMovementStateMachine);

CreateStateMachine<PlayerMovementContext>(player.id, 'player.movement', {
  id: 'movement',
  context: { hasAirAttack: false },
});

const result = RequestTransition(player.id, 'movement', 'move');
if (result.code !== 'applied') {
  // optional logging or metrics
}
```

### Chained transition example

```typescript
@OnStateEnter({ machineId: 'movement', state: PlayerState.DEAD })
onDead({ machine }: StateMachineTransitionPayload): void {
  if (shouldRespawnImmediately(machine.entityId)) {
    RequestTransition(machine.entityId, machine.machineId, 'respawn');
  }
}
```

In V3 this does not mutate the machine reentrantly during the current enter handler. It is appended to the queue and processed after the current transition is fully completed.

In that case `RequestTransition()` returns `queued`, not `applied`.

---

## Comparison

| Topic | V1 | V2 | V3 |
|---|---|---|---|
| Runtime ownership | Dedicated FSM registry | Component registry | Component registry |
| Definition storage | Per instance | Shared registry | Shared registry |
| Tick iteration | Entity scan | Entity scan | Active machine index |
| Transition semantics | Immediate | Immediate | Queued and deterministic |
| Failure detail | Boolean | Boolean plus blocked event | Structured result plus blocked event |
| Lifecycle completeness | Basic create/remove | Better cleanup | suspend, resume, finalize |
| Debug support | Limited | Better payloads | runtime snapshots and revisions |

---

## Recommended Implementation Order

1. implement the V2 foundation first if none of it exists yet
2. add `revision` and `suspended` to the component
3. add definitions registry validation
4. add transition queue and non-reentrant flush logic
5. add structured transition results and blocked events
6. add active machine index maintained by component add and remove events
7. add suspend and resume lifecycle events
8. add focused tests for chained transitions triggered from event handlers

---

## Final Recommendation

If the project is going to implement an FSM subsystem for real gameplay use, V3 is the best target.

V2 already fixes the architectural ownership problem. V3 goes one step further and fixes the execution model problem.

That matters because state machines stop being simple as soon as gameplay systems start reacting to state changes by requesting more state changes. Once that happens, deterministic sequencing is more important than shaving one file or one provider from the design.

V3 keeps the subsystem aligned with the current engine while making it safer under load, easier to debug, and more ready for future tooling.