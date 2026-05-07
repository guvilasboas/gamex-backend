# Player Movement V2

## Objective

This document proposes a new implementation for player movement based on the current code in `src/game/game-players` and on the new FSM subsystem available in the engine.

The goal is not only to move the player from point A to point B, but to make movement easier to evolve into:

- movement states
- animation state changes
- temporary disables such as stun or cutscene lock
- server-authoritative collision resolution
- future features like dash, knockback, slow, sprint or attack-lock movement

---

## Current Implementation

Today the movement flow is concentrated in `GamePlayersSystem.onMoveAction()`.

### Current flow

1. a `move` action arrives through `@OnAction('move')`
2. the action payload is converted into a normalized vector
3. the same handler decides whether the player is `idle` or `walking`
4. the same handler runs collision prediction through `WouldCollideAt()`
5. the same handler mutates the entity position directly
6. the same handler persists the new entity snapshot through `UpdateEntity()`

### Current code characteristics

- movement state is represented through tags on the entity: `idle` and `walking`
- speed is a field directly on `Player`
- movement only happens when a `move` action is processed
- collision is checked at the point of displacement, not as part of a broader locomotion pipeline
- there is no explicit movement state model beyond tags

---

## Problems In The Current Design

The current code works, but it has four structural limitations.

### 1. Input handling and world simulation are mixed

The `move` action handler is currently doing all of these jobs:

- reading client input
- deciding locomotion state
- resolving collision
- mutating the entity
- deciding presentation-oriented tags

That makes the code hard to extend because every new locomotion rule must be inserted into the same path.

### 2. Movement depends on input event frequency

The player only moves when a `move` action is dequeued.

That means movement progression is indirectly coupled to how often the client sends input snapshots. If the networking layer changes, the movement behavior changes too.

A better model is:

- input updates desired intent
- the server simulation applies locomotion every tick

### 3. Tags are carrying gameplay state

Using `idle` and `walking` tags directly on the entity is workable for a prototype, but weak as a movement state contract.

Tags are good for broad categorization like:

- `player`
- `collidable`
- `npc`

They are weaker for locomotion state because:

- they are easy to desynchronize
- they do not express transition rules
- they do not compose well with future states like `dash`, `stunned`, `dead`, `attack-locked`

### 4. There is no stable boundary between input, locomotion and presentation

As soon as the project needs different animation, sound, particles or stamina rules, movement will become a long conditional block in `GamePlayersSystem`.

---

## Design Goals For The New Implementation

The new implementation should follow these goals:

1. session actions only express player intent
2. movement simulation happens in the game loop, not directly in the action handler
3. locomotion state is explicit and server-owned
4. presentation reactions derive from movement state, not the other way around
5. collision remains authoritative on the server
6. the design should plug naturally into the FSM V3 subsystem

---

## Proposed Architecture

The new movement stack should be split into three layers.

### 1. Input layer

Receives `move` actions and updates a movement intent component.

### 2. Locomotion layer

Runs every game tick, reads the current input intent, updates the movement FSM, computes displacement, resolves collision and updates the entity.

### 3. Presentation layer

Reacts to movement state changes to update tags, render components or animation components.

This keeps the logic directional:

`session action -> input intent -> locomotion simulation -> state events -> presentation`

---

## Proposed Components And State Machines

### 1. `PlayerMoveIntentComponent`

This component stores the most recent movement input received from the session.

```typescript
@ComponentType('player-move-intent')
export class PlayerMoveIntentComponent extends Component {
  static readonly type = 'player-move-intent';

  input = new Vector3(0, 0, 0);
  lastInputTick = 0;
  active = false;
}
```

Purpose:

- decouple network input from movement simulation
- preserve latest intent between ticks
- make stop behavior explicit

### 2. `PlayerLocomotionComponent`

This component stores movement parameters that should not live directly on the entity.

```typescript
@ComponentType('player-locomotion')
export class PlayerLocomotionComponent extends Component {
  static readonly type = 'player-locomotion';

  speed = 5;
  lastMoveDirection = new Vector3(0, 1, 0);
}
```

Purpose:

- move locomotion tuning out of `Player`
- keep movement data in the component model already used by the engine
- make it easier to add slow, sprint or knockback modifiers later

### 3. `movement` state machine

The player should have one locomotion state machine attached on creation.

Suggested states:

- `idle`
- `moving`
- `blocked`
- `dead`

Initial version can start with just:

- `idle`
- `moving`

And then grow later.

Suggested definition:

```typescript
export const PlayerMovementState = {
  Idle: 'idle',
  Moving: 'moving',
  Blocked: 'blocked',
  Dead: 'dead',
} as const;

export const playerMovementStateMachine: StateMachineDefinition = {
  id: 'player.movement',
  initialState: PlayerMovementState.Idle,
  states: {
    [PlayerMovementState.Idle]: {
      id: PlayerMovementState.Idle,
      transitions: {
        startMove: { to: PlayerMovementState.Moving },
        block: { to: PlayerMovementState.Blocked },
        die: { to: PlayerMovementState.Dead },
      },
    },
    [PlayerMovementState.Moving]: {
      id: PlayerMovementState.Moving,
      transitions: {
        stopMove: { to: PlayerMovementState.Idle },
        block: { to: PlayerMovementState.Blocked },
        die: { to: PlayerMovementState.Dead },
      },
    },
    [PlayerMovementState.Blocked]: {
      id: PlayerMovementState.Blocked,
      transitions: {
        unblock: { to: PlayerMovementState.Idle },
        die: { to: PlayerMovementState.Dead },
      },
    },
    [PlayerMovementState.Dead]: {
      id: PlayerMovementState.Dead,
      transitions: {},
    },
  },
};
```

---

## New Responsibility Split

### `GamePlayersInputSystem`

Receives session actions and updates intent only.

Responsibilities:

- read `move` action
- resolve the player entity by session
- convert direction flags into vector intent
- patch `PlayerMoveIntentComponent`

It should not:

- move the player
- decide render tags
- update entity position directly

Example shape:

```typescript
@Injectable()
export class GamePlayersInputSystem {
  @OnAction('move')
  onMoveAction({ sessionId, action }: MoveAction): void {
    const player = GetEntity<Player>(sessionId);
    if (!player) return;

    const input = GetVectorFromDirections(action);

    PatchComponent(player.id, 'move-intent', {
      input,
      active: input.lengthSq() > 0,
      lastInputTick: Container.get(EngineStepper).getTick(),
    });
  }
}
```

### `GamePlayersMovementSystem`

Runs on every update tick and performs locomotion.

Responsibilities:

- read move intent
- read locomotion config
- drive FSM transitions
- compute desired delta
- resolve collision via `WouldCollideAt()`
- mutate the entity position only when simulation says so
- update entity facing
- call `UpdateEntity()` only when something changed

This becomes the only place where player locomotion is simulated.

### `GamePlayersPresentationSystem`

Listens to FSM events and updates presentation state.

Responsibilities:

- add or remove visual tags if the project still wants them
- switch animation component when entering `moving` or `idle`
- react to `blocked` or `dead` later without touching movement code

---

## Recommended File Structure

Suggested expansion under `src/game/game-players/`:

```text
src/game/game-players/
├── game-players.actions.ts
├── game-players.input.system.ts
├── game-players.movement.system.ts
├── game-players.presentation.system.ts
├── game-players.loader.ts
├── game-players.module.ts
├── player.entity.ts
├── player.factory.ts
├── player-locomotion.component.ts
├── player-move-intent.component.ts
├── player-movement.state-machine.ts
└── index.ts
```

The current `game-players.system.ts` should be split rather than expanded.

---

## Suggested Runtime Flow

### Session input

1. client sends `move`
2. `GamePlayersInputSystem` updates `PlayerMoveIntentComponent`

### Tick update

1. `GamePlayersMovementSystem` runs on update
2. it reads `PlayerMoveIntentComponent`
3. if input is non-zero, it requests `startMove`
4. if input is zero, it requests `stopMove`
5. if the state allows movement, it computes delta from speed
6. it predicts collision with `WouldCollideAt()`
7. if movement is valid, it updates position and facing
8. it calls `UpdateEntity()` only if position or facing changed

### Presentation

1. `GamePlayersPresentationSystem` listens to `@OnStateEnter({ machineId: 'movement' ... })`
2. entering `moving` updates animation or tags
3. entering `idle` updates animation or tags

---

## Suggested Entity And Factory Changes

### `Player`

`Player` should go back to being mostly world identity and transform data.

Recommended changes:

- keep `id`, `sessionId`, `position`, `size`, `tags`
- remove `speed` from the entity class
- avoid putting locomotion tuning directly on the entity

### `PlayerFactory`

When a player is created, it should:

1. create the entity
2. attach `PlayerLocomotionComponent`
3. attach `PlayerMoveIntentComponent`
4. attach the `movement` state machine

Example shape:

```typescript
build(): Player {
  const player = plainToInstance(Player, {
    id: this.sessionId,
    sessionId: this.sessionId,
    tags: ['player', 'collidable'],
  });

  CreateEntity(player);

  AttachComponent(player.id, PlayerLocomotionComponent, {
    id: 'locomotion',
    speed: 5,
  });

  AttachComponent(player.id, PlayerMoveIntentComponent, {
    id: 'move-intent',
  });

  CreateStateMachine(player.id, 'player.movement', {
    id: 'movement',
  });

  return player;
}
```

---

## Suggested Movement Tick Logic

The locomotion tick should look roughly like this:

```typescript
@Injectable()
export class GamePlayersMovementSystem {
  @OnUpdate()
  onUpdate(): void {
    for (const player of this.getPlayers()) {
      const intent = GetComponent(player.id, 'move-intent') as PlayerMoveIntentComponent | undefined;
      const locomotion = GetComponent(player.id, 'locomotion') as PlayerLocomotionComponent | undefined;

      if (!intent || !locomotion) continue;

      const isMoving = intent.active && intent.input.lengthSq() > 0;

      if (isMoving) {
        Transition(player.id, 'movement', 'startMove');
      } else {
        Transition(player.id, 'movement', 'stopMove');
      }

      if (!isMoving) continue;

      const delta = intent.input.clone().multiplyScalar(locomotion.speed);
      const futurePosition = player.position.clone().add(delta);

      if (WouldCollideAt(player.id, futurePosition)) {
        Transition(player.id, 'movement', 'block');
        continue;
      }

      player.position.copy(futurePosition);
      locomotion.lastMoveDirection.copy(intent.input);
      UpdateEntity(player);
    }
  }
}
```

This is still simple, but the responsibilities are much cleaner.

---

## What Should Happen To `idle` And `walking` Tags

Recommendation:

- stop using `idle` and `walking` as authoritative gameplay state
- if they are still useful for debug or filtering, derive them from FSM transitions in a presentation system

Example:

```typescript
@OnStateEnter({ machineId: 'movement', state: 'moving' })
onStartMoving({ entity }: StateMachineTransitionPayload): void {
  const player = GetEntity<Player>(entity.id);
  if (!player) return;

  player.addTag('walking');
  player.removeTag('idle');
  UpdateEntity(player);
}
```

That way tags become a projection of state, not the source of truth for state.

---

## Why This Design Is Better

### 1. It matches the engine better

The engine already has:

- component ownership
- per-tick update systems
- event-driven reactions
- a state machine subsystem

This proposal uses those primitives instead of concentrating everything in one action handler.

### 2. It makes movement deterministic at the simulation level

The player movement is now a server tick concern. Input only changes intent.

That is more stable than making movement progression depend on input event frequency.

### 3. It scales to more states

Once the FSM exists, adding more locomotion states becomes incremental:

- sprint
- dash
- knockback
- attack-lock
- stunned
- dead

### 4. It isolates future complexity

Animation changes, audio cues and VFX can listen to movement state events without changing the movement simulation code.

---

## Migration Plan

Recommended implementation order:

1. add `PlayerMoveIntentComponent`
2. add `PlayerLocomotionComponent`
3. define and register `player.movement` state machine
4. update `PlayerFactory` to attach the new components and FSM
5. replace the current `GamePlayersSystem` with `GamePlayersInputSystem`
6. add `GamePlayersMovementSystem` with per-tick locomotion
7. optionally add `GamePlayersPresentationSystem` for tags and animations
8. remove direct `idle` and `walking` state ownership from the action handler

---

## Final Recommendation

The next movement implementation should not be a bigger version of the current `onMoveAction()`.

It should be a split pipeline:

- action handler updates input intent
- movement system simulates locomotion on tick
- FSM owns movement state
- presentation systems react to state changes

That will give the project a movement model that is much easier to extend and much more aligned with the engine architecture you now have.