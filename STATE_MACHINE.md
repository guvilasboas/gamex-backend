# Engine State Machine — Design Proposal

## Overview

This document proposes the implementation of a **Finite State Machine (FSM)** subsystem for the engine, following the same architectural patterns already established: Registry / Manager / SDK, NestJS `@Injectable()` services, event-driven communication via `EventEmitter2`, and decorator-based hooks.

A state machine is represented as a **component** (`StateMachineComponent`) that can be attached to any entity. Multiple independent state machines can coexist on a single entity (e.g. `movement-fsm` and `combat-fsm`).

---

## Proposed Folder Structure

```
src/lib/engine/engine-state-machine/
├── index.ts
├── state-machine.component.ts           # The component attached to entities
├── engine-state-machine.types.ts        # Types: StateId, Transition, Guard, etc.
├── engine-state-machine.events.ts       # Event name constants
├── engine-state-machine.registry.ts     # In-memory storage of SM components
├── engine-state-machine.manager.ts      # Business logic + event emission
├── engine-state-machine.sdk.ts          # Public functional API
├── engine-state-machine.system.ts       # Game-loop hooks (OnUpdate / entity events)
├── engine-state-machine.module.ts       # NestJS @Global() module
└── on-state.decorators.ts               # @OnStateEnter, @OnStateExit, @OnStateUpdate
```

Register `EngineStateMachineModule` inside `EngineModule` alongside the other subsystem modules.

---

## Types — `engine-state-machine.types.ts`

```typescript
export type StateId = string;

export type TransitionGuard<TContext = unknown> = (
  context: TContext,
) => boolean;

export type StateTransition<TContext = unknown> = {
  /** The target state */
  to: StateId;
  /** Optional guard — transition is blocked if this returns false */
  guard?: TransitionGuard<TContext>;
};

export type StateDef<TContext = unknown> = {
  /** Unique identifier for this state within the machine */
  id: StateId;
  /** Allowed outgoing transitions */
  transitions?: Record<string, StateTransition<TContext>>;
};

export type StateMachineDef<TContext = unknown> = {
  /** Initial state when the component is first created */
  initialState: StateId;
  /** All possible states */
  states: StateDef<TContext>[];
  /** Optional arbitrary context data carried by the machine */
  context?: TContext;
};
```

---

## Component — `state-machine.component.ts`

Follows the same structure as `ColliderComponent`.

```typescript
import { ComponentType } from '../engine-entities/engine-entities-components/component-type.decorator';
import { Component } from '../engine-entities/engine-entities-components/component';
import { StateDef, StateId, StateMachineDef, TransitionGuard } from './engine-state-machine.types';

@ComponentType('state-machine')
export class StateMachineComponent<TContext = unknown> extends Component {
  static readonly type = 'state-machine';

  /** The full machine definition provided at creation time */
  definition: StateMachineDef<TContext>;

  /** Current active state */
  currentState: StateId;

  /** The state before the last transition (undefined on init) */
  previousState?: StateId;

  /** The game tick at which the current state was entered */
  stateEnteredAt: number = 0;

  /** Optional mutable context shared across states */
  context: TContext;

  // ── Derived helpers ───────────────────────────────────────────────────────

  get currentStateDef(): StateDef<TContext> | undefined {
    return this.definition.states.find((s) => s.id === this.currentState);
  }

  canTransition(transitionKey: string): boolean {
    const transitions = this.currentStateDef?.transitions ?? {};
    const transition = transitions[transitionKey];
    if (!transition) return false;
    if (transition.guard && !transition.guard(this.context)) return false;
    return true;
  }

  getTargetState(transitionKey: string): StateId | undefined {
    return this.currentStateDef?.transitions?.[transitionKey]?.to;
  }
}
```

---

## Events — `engine-state-machine.events.ts`

```typescript
/** Fired immediately after a state machine transitions to a new state */
export const ENGINE_SM_STATE_ENTER_EVENT = 'engine.sm.state.enter';

/** Fired immediately before leaving a state */
export const ENGINE_SM_STATE_EXIT_EVENT  = 'engine.sm.state.exit';

/** Fired every tick while a state is active (during GAME_UPDATE_EVENT) */
export const ENGINE_SM_STATE_UPDATE_EVENT = 'engine.sm.state.update';
```

Event payloads:

```typescript
// Enter / Exit
export type StateMachineTransitionPayload = {
  entityId: string;
  machineId: string;   // component id
  from: StateId;       // undefined on initial state entry
  to: StateId;
};

// Update
export type StateMachineUpdatePayload = {
  entityId: string;
  machineId: string;
  currentState: StateId;
  tick: number;
  deltaMs: number;
};
```

---

## Registry — `engine-state-machine.registry.ts`

Extends the established `EngineRegistry` base, keyed by `entityId + machineId`.

```typescript
@Injectable()
export class EngineStateMachineRegistry {
  private readonly store = new Map<string, StateMachineComponent>();

  private key(entityId: string, machineId: string): string {
    return `${entityId}::${machineId}`;
  }

  add(entityId: string, component: StateMachineComponent): void {
    this.store.set(this.key(entityId, component.id), component);
  }

  get(entityId: string, machineId: string): StateMachineComponent | undefined {
    return this.store.get(this.key(entityId, machineId));
  }

  getAllForEntity(entityId: string): StateMachineComponent[] {
    const prefix = `${entityId}::`;
    const result: StateMachineComponent[] = [];
    for (const [key, sm] of this.store) {
      if (key.startsWith(prefix)) result.push(sm);
    }
    return result;
  }

  remove(entityId: string, machineId: string): void {
    this.store.delete(this.key(entityId, machineId));
  }
}
```

---

## Manager — `engine-state-machine.manager.ts`

All transitions happen here. The manager validates guards, updates the component, and emits events.

```typescript
@Injectable()
export class EngineStateMachineManager {
  constructor(
    private readonly registry: EngineStateMachineRegistry,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Creation ──────────────────────────────────────────────────────────────

  create(
    entityId: string,
    definition: StateMachineDef,
    params: Partial<StateMachineComponent> & { id: string },
  ): StateMachineComponent {
    const sm = Object.assign(new StateMachineComponent(), {
      ...params,
      entityId,
      definition,
      currentState: definition.initialState,
      context: definition.context ?? {},
    });

    this.registry.add(entityId, sm);

    // Fire enter event for the initial state
    this.eventEmitter.emit(ENGINE_SM_STATE_ENTER_EVENT, {
      entityId,
      machineId: sm.id,
      from: undefined,
      to: sm.currentState,
    } satisfies StateMachineTransitionPayload);

    return sm;
  }

  // ── Transition ────────────────────────────────────────────────────────────

  transition(
    entityId: string,
    machineId: string,
    transitionKey: string,
    tick: number,
  ): boolean {
    const sm = this.registry.get(entityId, machineId);
    if (!sm) return false;
    if (!sm.canTransition(transitionKey)) return false;

    const from = sm.currentState;
    const to = sm.getTargetState(transitionKey)!;

    // EXIT
    this.eventEmitter.emit(ENGINE_SM_STATE_EXIT_EVENT, {
      entityId, machineId, from, to,
    } satisfies StateMachineTransitionPayload);

    sm.previousState = from;
    sm.currentState = to;
    sm.stateEnteredAt = tick;

    // ENTER
    this.eventEmitter.emit(ENGINE_SM_STATE_ENTER_EVENT, {
      entityId, machineId, from, to,
    } satisfies StateMachineTransitionPayload);

    return true;
  }

  // ── Force override (no guard) ─────────────────────────────────────────────

  forceState(
    entityId: string,
    machineId: string,
    state: StateId,
    tick: number,
  ): void {
    const sm = this.registry.get(entityId, machineId);
    if (!sm) return;

    const from = sm.currentState;

    this.eventEmitter.emit(ENGINE_SM_STATE_EXIT_EVENT, {
      entityId, machineId, from, to: state,
    } satisfies StateMachineTransitionPayload);

    sm.previousState = from;
    sm.currentState = state;
    sm.stateEnteredAt = tick;

    this.eventEmitter.emit(ENGINE_SM_STATE_ENTER_EVENT, {
      entityId, machineId, from, to: state,
    } satisfies StateMachineTransitionPayload);
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  tickEntity(entityId: string, tick: number, deltaMs: number): void {
    const machines = this.registry.getAllForEntity(entityId);
    for (const sm of machines) {
      this.eventEmitter.emit(ENGINE_SM_STATE_UPDATE_EVENT, {
        entityId,
        machineId: sm.id,
        currentState: sm.currentState,
        tick,
        deltaMs,
      } satisfies StateMachineUpdatePayload);
    }
  }

  get(entityId: string, machineId: string) {
    return this.registry.get(entityId, machineId);
  }

  removeAll(entityId: string): void {
    const machines = this.registry.getAllForEntity(entityId);
    for (const sm of machines) {
      this.registry.remove(entityId, sm.id);
    }
  }
}
```

---

## SDK — `engine-state-machine.sdk.ts`

Functional API, mirrors the pattern in `engine-entities-components.sdk.ts`.

```typescript
/** Attach a new state machine component to an entity */
export function CreateStateMachine<TContext = unknown>(
  entityId: string,
  definition: StateMachineDef<TContext>,
  params: Partial<StateMachineComponent<TContext>> & { id: string },
): StateMachineComponent<TContext> {
  const manager = Container.get<EngineStateMachineManager>(EngineStateMachineManager);
  // tick = 0 on creation (stateEnteredAt will be corrected on first update)
  return manager.create(entityId, definition, params) as StateMachineComponent<TContext>;
}

/** Attempt a named transition. Returns true if the transition was executed. */
export function Transition(
  entityId: string,
  machineId: string,
  transitionKey: string,
): boolean {
  const manager = Container.get<EngineStateMachineManager>(EngineStateMachineManager);
  const stepper = Container.get<EngineStepper>(EngineStepper);
  return manager.transition(entityId, machineId, transitionKey, stepper.tick);
}

/** Force the machine into a state, bypassing guards */
export function ForceState(
  entityId: string,
  machineId: string,
  state: StateId,
): void {
  const manager = Container.get<EngineStateMachineManager>(EngineStateMachineManager);
  const stepper = Container.get<EngineStepper>(EngineStepper);
  manager.forceState(entityId, machineId, state, stepper.tick);
}

/** Read the current state id */
export function GetCurrentState(
  entityId: string,
  machineId: string,
): StateId | undefined {
  const manager = Container.get<EngineStateMachineManager>(EngineStateMachineManager);
  return manager.get(entityId, machineId)?.currentState;
}

/** Read the full state machine component */
export function GetStateMachine<TContext = unknown>(
  entityId: string,
  machineId: string,
): StateMachineComponent<TContext> | undefined {
  const manager = Container.get<EngineStateMachineManager>(EngineStateMachineManager);
  return manager.get(entityId, machineId) as StateMachineComponent<TContext> | undefined;
}

/** Update the mutable context */
export function SetStateMachineContext<TContext = unknown>(
  entityId: string,
  machineId: string,
  context: Partial<TContext>,
): void {
  const manager = Container.get<EngineStateMachineManager>(EngineStateMachineManager);
  const sm = manager.get(entityId, machineId);
  if (sm) Object.assign(sm.context as object, context);
}
```

---

## System — `engine-state-machine.system.ts`

Handles cleanup on entity removal and drives per-tick update events.

```typescript
@Injectable()
export class EngineStateMachineSystem {
  constructor(
    private readonly manager: EngineStateMachineManager,
    private readonly entitiesRegistry: EngineEntitiesRegistry,
  ) {}

  /** Propagate update events to all live state machines each tick */
  @OnUpdate()
  onUpdate(event: EngineStepEvent): void {
    const entities = this.entitiesRegistry.getAll();
    for (const entity of entities) {
      this.manager.tickEntity(entity.id, event.tick, event.deltaMs);
    }
  }

  /** Auto-remove all state machines when an entity is deleted */
  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEntityDeleted(entity: Entity): void {
    this.manager.removeAll(entity.id);
  }
}
```

---

## Decorators — `on-state.decorators.ts`

Mirror the pattern from `collision-event.decorators.ts` and `entity-event.decorators.ts`.

```typescript
export type StateEventFilter = {
  /** Only match events for this machine id */
  machineId?: string;
  /** Only match events for this state */
  state?: StateId;
  /** Only match events for this entity type (@EntityDef type) */
  entityType?: string;
};

function makeStateDecorator(eventName: string) {
  return (filter?: StateEventFilter): MethodDecorator =>
    (target, propertyKey, descriptor: PropertyDescriptor) => {
      if (filter) {
        const original = descriptor.value;
        descriptor.value = function (
          payload: StateMachineTransitionPayload | StateMachineUpdatePayload,
        ) {
          if (filter.machineId && payload.machineId !== filter.machineId) return;
          const stateField =
            'to' in payload ? payload.to : payload.currentState;
          if (filter.state && stateField !== filter.state) return;
          return original.call(this, payload);
        };
      }
      OnEvent(eventName)(target, propertyKey, descriptor);
    };
}

/** Fires when entering a state */
export const OnStateEnter = makeStateDecorator(ENGINE_SM_STATE_ENTER_EVENT);

/** Fires when exiting a state */
export const OnStateExit = makeStateDecorator(ENGINE_SM_STATE_EXIT_EVENT);

/** Fires every tick while the given state is active */
export const OnStateUpdate = makeStateDecorator(ENGINE_SM_STATE_UPDATE_EVENT);
```

---

## Module — `engine-state-machine.module.ts`

```typescript
@Global()
@Module({
  providers: [
    EngineStateMachineRegistry,
    EngineStateMachineManager,
    EngineStateMachineSystem,
  ],
  exports: [
    EngineStateMachineRegistry,
    EngineStateMachineManager,
  ],
})
export class EngineStateMachineModule {}
```

Add to `EngineModule.imports`:

```typescript
imports: [
  EngineEntitiesModule,
  EngineCollisionsModule,
  EngineSessionsModule,
  EngineChunksModule,
  EngineStoreModule,
  EngineStateMachineModule,   // ← add here
  EngineDebugModule,
],
```

---

## Usage Example — Player State Machine

### 1. Define the states

```typescript
// game-players/player.states.ts

export const PlayerState = {
  IDLE:      'idle',
  RUNNING:   'running',
  JUMPING:   'jumping',
  ATTACKING: 'attacking',
  DEAD:      'dead',
} as const;

export type PlayerState = typeof PlayerState[keyof typeof PlayerState];

export const playerFsmDef: StateMachineDef = {
  initialState: PlayerState.IDLE,
  states: [
    {
      id: PlayerState.IDLE,
      transitions: {
        move:   { to: PlayerState.RUNNING },
        jump:   { to: PlayerState.JUMPING },
        attack: { to: PlayerState.ATTACKING },
        die:    { to: PlayerState.DEAD },
      },
    },
    {
      id: PlayerState.RUNNING,
      transitions: {
        stop:   { to: PlayerState.IDLE },
        jump:   { to: PlayerState.JUMPING },
        attack: { to: PlayerState.ATTACKING },
        die:    { to: PlayerState.DEAD },
      },
    },
    {
      id: PlayerState.JUMPING,
      transitions: {
        land:   { to: PlayerState.IDLE },
        die:    { to: PlayerState.DEAD },
        // guard example: can only attack in the air if player has the skill
        attack: {
          to: PlayerState.ATTACKING,
          guard: (ctx: PlayerContext) => ctx.hasAirAttack,
        },
      },
    },
    {
      id: PlayerState.ATTACKING,
      transitions: {
        finish: { to: PlayerState.IDLE },
        die:    { to: PlayerState.DEAD },
      },
    },
    {
      id: PlayerState.DEAD,
      transitions: {
        respawn: { to: PlayerState.IDLE },
      },
    },
  ],
};
```

### 2. Attach machine on entity creation

```typescript
// game-players/player.factory.ts

export function createPlayer(sessionId: string): Player {
  const player = CreateEntity(
    Object.assign(new Player(), { sessionId }),
  );

  // Attach the FSM
  CreateStateMachine(player.id, playerFsmDef, { id: 'movement' });

  return player;
}
```

### 3. Trigger transitions from a system

```typescript
// game-players/game-players.system.ts

@Injectable()
export class GamePlayersSystem {

  @OnAction('move')
  onMove({ sessionId, action }: DispatchedSessionAction<MoveAction>): void {
    const player = GetPlayerBySession(sessionId);
    if (!player) return;

    // Attempt transition — no-op if guard fails or transition not defined
    Transition(player.id, 'movement', 'move');

    // ... apply velocity
  }

  @OnAction('stop')
  onStop({ sessionId }: DispatchedSessionAction): void {
    const player = GetPlayerBySession(sessionId);
    if (!player) return;

    Transition(player.id, 'movement', 'stop');
  }

  @OnCollisionEnter({ colliderTag: 'hazard', side: 'b' })
  onHazardHit(manifold: CollisionManifold): void {
    const { entityAId } = manifold;
    Transition(entityAId, 'movement', 'die');
  }
}
```

### 4. React to state changes with decorators

```typescript
// game-players/game-players.animations.system.ts
// (or inline in game-players.system.ts)

@Injectable()
export class GamePlayersAnimationsSystem {

  @OnStateEnter({ machineId: 'movement', state: PlayerState.RUNNING })
  onStartRunning({ entityId }: StateMachineTransitionPayload): void {
    AttachComponent(entityId, AnimationComponent, {
      id: 'anim',
      clip: 'run',
      loop: true,
    });
  }

  @OnStateEnter({ machineId: 'movement', state: PlayerState.IDLE })
  onIdle({ entityId }: StateMachineTransitionPayload): void {
    AttachComponent(entityId, AnimationComponent, {
      id: 'anim',
      clip: 'idle',
      loop: true,
    });
  }

  @OnStateEnter({ machineId: 'movement', state: PlayerState.DEAD })
  onDead({ entityId }: StateMachineTransitionPayload): void {
    AttachComponent(entityId, AnimationComponent, {
      id: 'anim',
      clip: 'death',
      loop: false,
    });
  }

  @OnStateUpdate({ machineId: 'movement', state: PlayerState.ATTACKING })
  onAttackTick({ entityId, tick }: StateMachineUpdatePayload): void {
    const sm = GetStateMachine(entityId, 'movement');
    // Auto-finish attack after 30 ticks (0.5 s at 60 fps)
    if (sm && tick - sm.stateEnteredAt >= 30) {
      Transition(entityId, 'movement', 'finish');
    }
  }
}
```

---

## Integration Summary

| Concept | File | Mirrors |
|---|---|---|
| Component | `state-machine.component.ts` | `collider.component.ts` |
| Types | `engine-state-machine.types.ts` | `engine-collisions.types.ts` |
| Events | `engine-state-machine.events.ts` | `engine-collisions.events.ts` |
| Registry | `engine-state-machine.registry.ts` | `engine-collisions.registry.ts` |
| Manager | `engine-state-machine.manager.ts` | `engine-collisions.manager.ts` |
| SDK | `engine-state-machine.sdk.ts` | `engine-entities-components.sdk.ts` |
| System | `engine-state-machine.system.ts` | `engine-chunks.system.ts` |
| Decorators | `on-state.decorators.ts` | `collision-event.decorators.ts` |
| Module | `engine-state-machine.module.ts` | `engine-collisions.module.ts` |

---

## Design Decisions & Notes

- **No base class for states** — states are plain `StateId` strings, keeping the system data-driven and lightweight, consistent with how the rest of the engine handles type identifiers.
- **Multiple machines per entity** — each `StateMachineComponent` is identified by `id` (same pattern as components), so `movement`, `combat`, and `dialog` FSMs can coexist on one entity.
- **Guards receive `context`** — the optional `context` object on the component provides a typed, mutable bag for guard conditions, avoiding coupling to the entity directly.
- **`ForceState` for server authority** — bypasses guards for cases where the server must override client state (e.g. respawn, teleport, stun).
- **`stateEnteredAt` (tick number)** — enables time-in-state logic (attack duration, invincibility frames, cooldowns) without external timers.
- **No hierarchical states (HSM) in v1** — can be added later by making `StateDef.parent?: StateId` and bubbling unhandled transitions up the hierarchy.
