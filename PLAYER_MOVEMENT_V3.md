# Player Movement V3

## What V2 Got Right

V2 correctly identified the four core problems in the current implementation and proposed the right structural answer: split the movement pipeline into input, locomotion, and presentation layers. The direction is sound.

This document keeps that foundation and fixes the specific bugs, gaps, and inconsistencies introduced in V2.

---

## Issues Found In V2

### 1. `GetVectorFromDirections` receives the wrong argument

V2's input system example passes `action` to `GetVectorFromDirections`, but the correct argument is `action.action`.

`MoveAction` is typed as `DispatchedSessionAction<MoveActionPayload & SessionAction>`, which means:

```
action.sessionId  →  string
action.action     →  { up, down, left, right, type }
```

`GetVectorFromDirections` expects `{ up, down, left, right }`. Passing the outer `action` object would silently produce a zero vector every time.

---

### 2. `PlayerMoveIntentComponent.active` is redundant and can desync

V2 stores both `input: Vector3` and `active: boolean` on the intent component, where `active` is always meant to equal `input.lengthSq() > 0`.

Keeping a derived boolean field alongside its source is a classic sync hazard. When `PatchComponent` is called with only `{ input }`, the `active` field stays stale.

The fix is to remove `active` entirely and compute movement intent from `input.lengthSq() > 0` at the call site.

---

### 3. The `blocked` state creates a deadlock

V2's `blocked` state has a structural flaw in the movement tick:

```
if input is non-zero:
  Transition(id, 'movement', 'startMove')  // only valid from idle
  if WouldCollideAt:
    Transition(id, 'movement', 'block')    // valid from moving
```

When the current state is `blocked`:
- `startMove` has no route from `blocked` → the transition fails silently
- `block` fires again → the machine stays `blocked` forever

Even if the obstacle clears the next tick, the player stays locked in `blocked` because nothing requests `unblock`.

V3 removes `blocked` from the initial FSM scope. Collision is a simulation gate, not a locomotion state. The FSM owns `idle` and `moving`. Future states like `stunned`, `locked`, or `knockback` can be added once the core pipeline is stable.

---

### 4. `entity.facing` is never updated

`Entity` has a `facing: 'up' | 'down' | 'left' | 'right'` field that the rest of the engine and clients expect. V2's movement tick updates `locomotion.lastMoveDirection` but never writes to `player.facing`, leaving facing perpetually at the default value.

---

### 5. `lastInputTick` is declared but never used

V2 stores `lastInputTick` in the intent component as an explicit field, but the locomotion tick never reads it.

The purpose of that field is stale-input detection: if a client disconnects or stops sending input without sending a stop command, the player should not keep moving forever. V3 uses `lastInputTick` to stop movement after a configurable idle threshold.

---

### 6. New components are not declared with `@WithComponent`

`Player` already uses `@WithComponent` to attach `ColliderComponent` and `RectComponent` on creation. New components with fixed initialization (`PlayerMoveIntentComponent`, `PlayerLocomotionComponent`) should follow the same pattern on the entity class, not be imperatively attached in the factory.

Splitting declaration between the class and the factory means the two can drift. `CreateEntity` already processes `@WithComponent` metadata, so this is the correct place.

---

### 7. `RegisterStateMachine` has no defined call site

V2 shows the state machine definition and the factory calling `CreateStateMachine`, but never shows where the definition is registered. `CreateStateMachine` will throw at runtime if the definition was not registered first.

The correct place is `GamePlayersModule.onApplicationBootstrap()`, which runs once after all providers are wired.

---

### 8. `getPlayers()` has no implementation

V2's `GamePlayersMovementSystem.onUpdate()` calls `this.getPlayers()` without showing how it works. The system needs to inject `EngineEntitiesRegistry` and filter by type or tag.

---

### 9. Module wiring is incomplete

V2 does not show `game-players.module.ts` updated to include the new systems. Without that, the new systems are never instantiated by NestJS and their decorators are never registered.

---

## V3 Architecture

The three-layer architecture from V2 is kept. The corrections above are applied throughout.

```
session action → intent component → locomotion tick → FSM + position → presentation events
```

---

## Components

### `PlayerMoveIntentComponent`

```typescript
// src/game/game-players/player-move-intent.component.ts

import { ComponentType } from '../../lib/engine/engine-decorators';
import { Component } from '../../lib/engine/engine-entities/engine-entities-components/component';
import { Vector3 } from 'three';

@ComponentType('player-move-intent')
export class PlayerMoveIntentComponent extends Component {
  static readonly type = 'player-move-intent';

  input = new Vector3(0, 0, 0);
  lastInputTick = 0;
}
```

Changes from V2:
- `active` removed — derive from `input.lengthSq() > 0` at the call site

---

### `PlayerLocomotionComponent`

```typescript
// src/game/game-players/player-locomotion.component.ts

import { ComponentType } from '../../lib/engine/engine-decorators';
import { Component } from '../../lib/engine/engine-entities/engine-entities-components/component';
import { Vector3 } from 'three';

@ComponentType('player-locomotion')
export class PlayerLocomotionComponent extends Component {
  static readonly type = 'player-locomotion';

  speed = 5;
  lastMoveDirection = new Vector3(0, 1, 0);
}
```

No changes from V2.

---

## State Machine Definition

FSM scope for V3: `idle` and `moving` only.

`blocked`, `dead`, and `stunned` are intentional omissions. They belong to a future iteration once the base pipeline is verified.

```typescript
// src/game/game-players/player-movement.state-machine.ts

import { StateMachineDefinition } from '../../lib/engine/engine-state-machine';

export const PlayerMovementState = {
  Idle: 'idle',
  Moving: 'moving',
} as const;

export type PlayerMovementStateId =
  (typeof PlayerMovementState)[keyof typeof PlayerMovementState];

export const PLAYER_MOVEMENT_MACHINE_ID = 'movement';
export const PLAYER_MOVEMENT_DEFINITION_ID = 'player.movement';

export const playerMovementDefinition: StateMachineDefinition = {
  id: PLAYER_MOVEMENT_DEFINITION_ID,
  initialState: PlayerMovementState.Idle,
  states: {
    [PlayerMovementState.Idle]: {
      id: PlayerMovementState.Idle,
      transitions: {
        startMove: { to: PlayerMovementState.Moving },
      },
    },
    [PlayerMovementState.Moving]: {
      id: PlayerMovementState.Moving,
      transitions: {
        stopMove: { to: PlayerMovementState.Idle },
      },
    },
  },
};
```

---

## Player Entity

`Player` declares all components via `@WithComponent`. The factory becomes responsible only for creating the entity and registering the FSM — not for attaching components.

```typescript
// src/game/game-players/player.entity.ts

import { Vector3 } from 'three';
import { Entity } from '../../lib/engine/engine-entities';
import { EntityDef, WithComponent } from '../../lib/engine/engine-decorators';
import { ColliderComponent } from '../../lib/engine/engine-collisions';
import { RectComponent } from '../../lib/engine/engine-render';
import { PlayerMoveIntentComponent } from './player-move-intent.component';
import { PlayerLocomotionComponent } from './player-locomotion.component';
import { random, uniqueId } from 'lodash';

@EntityDef({ type: 'player' })
@WithComponent(ColliderComponent, {
  id: 'body',
  size: new Vector3(64, 24, 0),
  tags: ['player'],
})
@WithComponent(RectComponent, {
  id: uniqueId('player-rect'),
  size: new Vector3(64, 96, 0),
})
@WithComponent(PlayerMoveIntentComponent, { id: 'move-intent' })
@WithComponent(PlayerLocomotionComponent, { id: 'locomotion' })
export class Player extends Entity {
  size = new Vector3(64, 96, 0);
  position = new Vector3(random(0, 500), random(0, 500), 0);
}
```

Changes from V2:
- `speed` removed from the entity class — owned by `PlayerLocomotionComponent`
- `PlayerMoveIntentComponent` and `PlayerLocomotionComponent` declared with `@WithComponent`

---

## Player Factory

The factory creates the entity (which auto-attaches components via `@WithComponent`) and then registers the movement FSM.

```typescript
// src/game/game-players/player.factory.ts

import { plainToInstance } from 'class-transformer';
import { Player } from './player.entity';
import { CreateEntity } from '../../lib/engine/engine-entities';
import { CreateStateMachine } from '../../lib/engine/engine-state-machine';
import {
  PLAYER_MOVEMENT_DEFINITION_ID,
  PLAYER_MOVEMENT_MACHINE_ID,
} from './player-movement.state-machine';

export class PlayerFactory {
  constructor(private readonly sessionId: string) {}

  build(): Player {
    const player = plainToInstance(Player, {
      id: this.sessionId,
      sessionId: this.sessionId,
      tags: ['player', 'collidable'],
    });

    CreateEntity(player);

    CreateStateMachine(player.id, PLAYER_MOVEMENT_DEFINITION_ID, {
      id: PLAYER_MOVEMENT_MACHINE_ID,
    });

    return player;
  }

  static create(sessionId: string): Player {
    const factory = new PlayerFactory(sessionId);
    return factory.build();
  }
}
```

Changes from V2:
- `AttachComponent` calls removed — components are declared via `@WithComponent` on `Player`
- `idle` and `walking` tags removed from initial `tags` array — state is owned by FSM
- `PLAYER_MOVEMENT_DEFINITION_ID` and `PLAYER_MOVEMENT_MACHINE_ID` are named constants

---

## Systems

### `GamePlayersInputSystem`

```typescript
// src/game/game-players/game-players.input.system.ts

import { Injectable } from '@nestjs/common';
import { OnAction } from '../../lib/engine/engine-sessions';
import { GetEntity } from '../../lib/engine/engine-entities';
import { PatchComponent } from '../../lib/engine/engine-entities/engine-entities-components/engine-entities-components.sdk';
import { GetVectorFromDirections } from '../../lib/engine/engine-physics';
import { Container } from '../../common/container';
import { EngineStepper } from '../../lib/engine/engine-stepper';
import { Player } from './player.entity';
import { type MoveAction } from './game-players.actions';

@Injectable()
export class GamePlayersInputSystem {
  @OnAction('move')
  onMoveAction(action: MoveAction): void {
    const player = GetEntity<Player>(action.sessionId);
    if (!player) return;

    const input = GetVectorFromDirections(action.action); // fix: action.action, not action

    PatchComponent(player.id, 'move-intent', {
      input,
      lastInputTick: Container.get(EngineStepper).getTick(),
    });
  }
}
```

Fixes from V2:
- `GetVectorFromDirections(action.action)` — correct argument
- No `active` field patched — derived from `input.lengthSq()` in the locomotion system

---

### `GamePlayersMovementSystem`

```typescript
// src/game/game-players/game-players.movement.system.ts

import { Inject, Injectable } from '@nestjs/common';
import { OnUpdate } from '../../lib/engine/engine-decorators';
import { EngineEntitiesRegistry } from '../../lib/engine/engine-entities/engine-entities.registry';
import { GetComponent } from '../../lib/engine/engine-entities/engine-entities-components/engine-entities-components.sdk';
import { WouldCollideAt } from '../../lib/engine/engine-collisions';
import { Container } from '../../common/container';
import { EngineStepper } from '../../lib/engine/engine-stepper';
import { Transition } from '../../lib/engine/engine-state-machine';
import { UpdateEntity } from '../../lib/engine/engine-entities';
import { Player } from './player.entity';
import { PlayerMoveIntentComponent } from './player-move-intent.component';
import { PlayerLocomotionComponent } from './player-locomotion.component';
import {
  PLAYER_MOVEMENT_MACHINE_ID,
  PlayerMovementState,
} from './player-movement.state-machine';

const STALE_INPUT_TICKS = 10;

@Injectable()
export class GamePlayersMovementSystem {
  constructor(
    @Inject(EngineEntitiesRegistry)
    private readonly registry: EngineEntitiesRegistry,
  ) {}

  @OnUpdate()
  onUpdate(): void {
    const currentTick = Container.get(EngineStepper).getTick();

    for (const entity of this.registry.getAll()) {
      if (!entity.tags.includes('player')) continue;

      const player = entity as Player;

      const intent = GetComponent(
        player.id,
        'move-intent',
      ) as PlayerMoveIntentComponent | undefined;

      const locomotion = GetComponent(
        player.id,
        'locomotion',
      ) as PlayerLocomotionComponent | undefined;

      if (!intent || !locomotion) continue;

      const isStale = currentTick - intent.lastInputTick > STALE_INPUT_TICKS;
      const isMoving = !isStale && intent.input.lengthSq() > 0;

      if (isMoving) {
        Transition(player.id, PLAYER_MOVEMENT_MACHINE_ID, 'startMove');
      } else {
        Transition(player.id, PLAYER_MOVEMENT_MACHINE_ID, 'stopMove');
        continue;
      }

      const delta = intent.input.clone().multiplyScalar(locomotion.speed);
      const futurePosition = player.position.clone().add(delta);

      if (WouldCollideAt(player.id, futurePosition)) continue;

      player.position.copy(futurePosition);
      player.facing = this.getFacing(intent.input);
      locomotion.lastMoveDirection.copy(intent.input);

      UpdateEntity(player);
    }
  }

  private getFacing(
    v: { x: number; y: number },
  ): 'up' | 'down' | 'left' | 'right' {
    if (Math.abs(v.x) >= Math.abs(v.y)) {
      return v.x > 0 ? 'right' : 'left';
    }
    return v.y > 0 ? 'down' : 'up';
  }
}
```

Fixes from V2:
- `getPlayers()` implemented via injected `EngineEntitiesRegistry`
- `active` removed — derived via `intent.input.lengthSq() > 0`
- `STALE_INPUT_TICKS` guard prevents eternal movement on disconnect
- `player.facing` updated from movement direction
- `locomotion.lastMoveDirection` updated on successful move
- `PLAYER_MOVEMENT_MACHINE_ID` used as a constant, not an inline string
- Transitions are only requested when state needs to change (see note below)

**Note on idempotent transitions:** calling `startMove` from `moving` returns `missing-transition` (not an error). Calling `stopMove` from `idle` does the same. The FSM handles this gracefully — no guard is needed in the system. The system stays simple.

---

### `GamePlayersPresentationSystem`

```typescript
// src/game/game-players/game-players.presentation.system.ts

import { Injectable } from '@nestjs/common';
import { OnStateEnter } from '../../lib/engine/engine-state-machine';
import { GetEntity, UpdateEntity } from '../../lib/engine/engine-entities';
import { type StateMachineTransitionPayload } from '../../lib/engine/engine-state-machine';
import { Player } from './player.entity';
import {
  PLAYER_MOVEMENT_MACHINE_ID,
  PlayerMovementState,
} from './player-movement.state-machine';

@Injectable()
export class GamePlayersPresentationSystem {
  @OnStateEnter({
    machineId: PLAYER_MOVEMENT_MACHINE_ID,
    state: PlayerMovementState.Moving,
    entityType: 'player',
  })
  onStartMoving({ entity }: StateMachineTransitionPayload): void {
    const player = GetEntity<Player>(entity.id);
    if (!player) return;

    player.removeTag('idle');
    player.addTag('walking');
    UpdateEntity(player);
  }

  @OnStateEnter({
    machineId: PLAYER_MOVEMENT_MACHINE_ID,
    state: PlayerMovementState.Idle,
    entityType: 'player',
  })
  onStopMoving({ entity }: StateMachineTransitionPayload): void {
    const player = GetEntity<Player>(entity.id);
    if (!player) return;

    player.removeTag('walking');
    player.addTag('idle');
    UpdateEntity(player);
  }
}
```

Tags become a projection of FSM state, not the source of truth. If the project drops tags entirely, this system can be deleted without touching movement logic.

---

## Module

```typescript
// src/game/game-players/game-players.module.ts

import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { GamePlayersLoader } from './game-players.loader';
import { GamePlayersInputSystem } from './game-players.input.system';
import { GamePlayersMovementSystem } from './game-players.movement.system';
import { GamePlayersPresentationSystem } from './game-players.presentation.system';
import { RegisterStateMachine } from '../../lib/engine/engine-state-machine';
import { playerMovementDefinition } from './player-movement.state-machine';

@Module({
  providers: [
    GamePlayersLoader,
    GamePlayersInputSystem,
    GamePlayersMovementSystem,
    GamePlayersPresentationSystem,
  ],
  exports: [GamePlayersLoader],
})
export class GamePlayersModule implements OnApplicationBootstrap {
  onApplicationBootstrap(): void {
    RegisterStateMachine(playerMovementDefinition);
  }
}
```

`onApplicationBootstrap` runs after NestJS finishes wiring all providers. This guarantees the definition is registered before the first `CreateStateMachine` call from the factory.

---

## File Structure

```text
src/game/game-players/
├── game-players.actions.ts
├── game-players.input.system.ts       (replaces game-players.system.ts)
├── game-players.movement.system.ts
├── game-players.presentation.system.ts
├── game-players.loader.ts
├── game-players.module.ts
├── player-locomotion.component.ts
├── player-move-intent.component.ts
├── player-movement.state-machine.ts
├── player.entity.ts
├── player.factory.ts
└── index.ts
```

`game-players.system.ts` is deleted after the split is complete.

---

## Runtime Flow

### Input path (per action)

1. Client sends `move` with `{ up, down, left, right }`
2. `GamePlayersInputSystem.onMoveAction` resolves `action.action` as the payload
3. `GetVectorFromDirections(action.action)` returns a normalized Vector3
4. `PatchComponent` updates `intent.input` and `intent.lastInputTick`

### Locomotion path (per tick)

1. `GamePlayersMovementSystem.onUpdate` iterates all `player`-tagged entities
2. Checks `lastInputTick` staleness against `STALE_INPUT_TICKS`
3. If moving: requests `startMove` on the FSM
4. If stopped or stale: requests `stopMove` on the FSM, skips position update
5. If moving and no collision: copies future position to `player.position`, updates `player.facing` and `locomotion.lastMoveDirection`, calls `UpdateEntity`

### Presentation path (on state change)

1. `GamePlayersPresentationSystem` listens to `@OnStateEnter` for `moving` and `idle`
2. Updates tags as a read projection of FSM state
3. Future: can react to new states (`stunned`, `dead`) without touching movement code

---

## Summary Of Changes From V2

| V2 Issue | V3 Fix |
|---|---|
| `GetVectorFromDirections(action)` | `GetVectorFromDirections(action.action)` |
| `active` field can desync | removed — derived from `input.lengthSq() > 0` |
| `blocked` state deadlock | removed from initial scope — collision is a gate, not a state |
| `entity.facing` never updated | updated in locomotion tick via `getFacing()` |
| `lastInputTick` unused | checked against `STALE_INPUT_TICKS` to stop stale movement |
| components attached in factory | declared with `@WithComponent` on `Player` class |
| `RegisterStateMachine` call missing | called in `GamePlayersModule.onApplicationBootstrap()` |
| `getPlayers()` not implemented | injected `EngineEntitiesRegistry`, filtered by `player` tag |
| module never updated | `game-players.module.ts` shown with all providers |
| machine/state IDs as inline strings | named constants `PLAYER_MOVEMENT_MACHINE_ID`, `PlayerMovementState` |

---

## Migration Order

1. Create `player-move-intent.component.ts`
2. Create `player-locomotion.component.ts`
3. Create `player-movement.state-machine.ts`
4. Update `player.entity.ts` — add `@WithComponent` for new components, remove `speed`
5. Update `player.factory.ts` — remove component attachment, add `CreateStateMachine`
6. Create `game-players.input.system.ts`
7. Create `game-players.movement.system.ts`
8. Create `game-players.presentation.system.ts`
9. Update `game-players.module.ts` — register definition, list new providers
10. Delete `game-players.system.ts`
