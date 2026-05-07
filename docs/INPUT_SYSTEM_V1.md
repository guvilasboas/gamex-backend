# Input System V1

## Objective

This document proposes a server-side input system for the current `gamex-backend` engine.

The goal is to make player input queryable during the game loop, so any system can ask questions such as:

- is `move.up` currently pressed?
- was `move.up` pressed this tick?
- was `move.up` released this tick?
- how long has `move.up` been held?
- what is the current movement vector for this player?

The important design decision is: socket actions should not directly move the player. Socket actions should update input state. Game systems should read that state during the loop.

---

## Current Implementation

Today, player movement is handled through session actions.

Current flow:

1. the client sends a `move` action
2. `EngineSessionsManager.pushAction()` stores the action in the session action queue
3. `EngineSessionSystem` processes queued actions during `GAME_BEFORE_UPDATE_EVENT`
4. each action emits a typed event such as `session.action.move`
5. `GamePlayersSystem.onMoveAction()` receives the action
6. the action payload is converted into a movement vector
7. the player position is updated immediately inside the action handler

This works for the current prototype, but it has a weak input model.

The current system can answer:

```ts
"what action just arrived?"
```

But it cannot reliably answer:

```ts
"what buttons are held right now?"
"which buttons were released this tick?"
"did this input start this frame?"
```

---

## Problems In The Current Design

### 1. Input events and input state are mixed

A socket action is an event. It happened once.

A pressed key is state. It remains true until released.

The current `move` action carries directional booleans, but there is no general input state model behind it. That means each gameplay system has to invent its own interpretation of the latest action.

---

### 2. Gameplay systems cannot query input cleanly

A movement system, attack system, dash system or interaction system should be able to ask:

```ts
input.isPressed(sessionId, 'move.up')
input.wasPressed(sessionId, 'attack.primary')
input.wasReleased(sessionId, 'dash')
```

Without knowing anything about socket payloads, session action queues or network event names.

---

### 3. Release detection needs two snapshots

To know if a key was released this tick, the engine needs to compare:

- previous input state
- current input state

A single latest action is not enough unless each action handler implements its own previous/current comparison.

---

### 4. Input lifetime is not explicit

For movement, the server needs to know whether the last input is still valid.

If a client disconnects or stops sending input updates, the server should be able to expire input after a threshold.

This should be a shared input-system concern, not duplicated inside every gameplay system.

---

## Design Goals

The input system should follow these goals:

1. network messages update input state only
2. game systems read input during the loop
3. pressed, released and held states are derived centrally
4. input state is stored per session
5. gameplay code should use input actions, not raw keyboard names
6. input should support both digital and analog values later
7. stale input should be detectable
8. the system should fit the existing NestJS/EventEmitter/game-loop architecture

---

## Proposed Architecture

The input stack should be split into four layers.

```text
socket action
  -> session action queue
    -> input action handler
      -> EngineInputManager
        -> input snapshots
          -> gameplay systems query input during update
```

### 1. Transport layer

Receives socket messages and pushes session actions.

This layer should not know about gameplay.

Example action sent by the client:

```ts
{
  type: 'input.snapshot',
  inputs: {
    'move.up': true,
    'move.down': false,
    'move.left': false,
    'move.right': true,
    'attack.primary': false,
  },
  sequence: 1024
}
```

---

### 2. Input ingestion layer

Receives input actions through `@OnAction('input.snapshot')` or `@OnAction('input.event')`.

It validates the payload and updates `EngineInputManager`.

It should not move entities.
It should not decide animation.
It should not run collision.

---

### 3. Input state layer

Stores the current and previous input state per session.

This layer owns the meaning of:

- pressed
- released
- down
- up
- held ticks
- stale input

---

### 4. Gameplay query layer

Gameplay systems call a small API from inside the loop.

Example:

```ts
const input = this.input.getSession(player.sessionId);

if (input.isDown('move.up')) {}
if (input.wasPressed('dash')) {}
if (input.wasReleased('attack.primary')) {}
```

---

## Recommended Input Model

### Input names

Use semantic action names, not physical keys.

Good:

```ts
'move.up'
'move.down'
'move.left'
'move.right'
'attack.primary'
'interact'
'dash'
```

Avoid:

```ts
'w'
'a'
'space'
'mouse-left'
```

The frontend should translate physical keys/buttons into semantic actions.

This keeps the backend independent from keyboard layout, controller mapping and mobile controls.

---

## Core Types

Create a new engine module:

```text
src/lib/engine/engine-input/
├── engine-input.types.ts
├── engine-input.manager.ts
├── engine-input.registry.ts
├── engine-input.system.ts
├── engine-input.sdk.ts
├── engine-input.module.ts
└── index.ts
```

---

### `engine-input.types.ts`

```ts
export type InputName = string;

export type DigitalInputValue = boolean;

export type AnalogInputValue = number;

export type VectorInputValue = {
  x: number;
  y: number;
};

export type InputValue =
  | DigitalInputValue
  | AnalogInputValue
  | VectorInputValue;

export type InputSnapshotPayload = {
  type: 'input.snapshot';
  sequence?: number;
  inputs: Record<InputName, InputValue>;
};

export type InputEventPayload = {
  type: 'input.event';
  sequence?: number;
  input: InputName;
  value: InputValue;
};

export type InputFrameState = {
  values: Map<InputName, InputValue>;
  changedAtTick: Map<InputName, number>;
  sequence?: number;
  updatedAtTick: number;
};

export type InputSessionState = {
  sessionId: string;
  previous: InputFrameState;
  current: InputFrameState;
};
```

The first version can focus only on boolean values. The shape above leaves room for analog values later.

---

## Registry

### `engine-input.registry.ts`

```ts
import { Injectable } from '@nestjs/common';
import { InputFrameState, InputSessionState } from './engine-input.types';

function createFrameState(tick = 0): InputFrameState {
  return {
    values: new Map(),
    changedAtTick: new Map(),
    updatedAtTick: tick,
  };
}

export function createInputSessionState(
  sessionId: string,
  tick = 0,
): InputSessionState {
  return {
    sessionId,
    previous: createFrameState(tick),
    current: createFrameState(tick),
  };
}

@Injectable()
export class EngineInputRegistry {
  private readonly sessions = new Map<string, InputSessionState>();

  get(sessionId: string): InputSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreate(sessionId: string, tick = 0): InputSessionState {
    let state = this.sessions.get(sessionId);

    if (!state) {
      state = createInputSessionState(sessionId, tick);
      this.sessions.set(sessionId, state);
    }

    return state;
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getAll(): InputSessionState[] {
    return Array.from(this.sessions.values());
  }
}
```

---

## Input Manager

### `engine-input.manager.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import { EngineStepper } from '../engine-stepper';
import { EngineInputRegistry } from './engine-input.registry';
import { InputName, InputValue } from './engine-input.types';

@Injectable()
export class EngineInputManager {
  constructor(
    @Inject(EngineInputRegistry)
    private readonly registry: EngineInputRegistry,

    @Inject(EngineStepper)
    private readonly stepper: EngineStepper,
  ) {}

  setSnapshot(
    sessionId: string,
    inputs: Record<InputName, InputValue>,
    sequence?: number,
  ): void {
    const tick = this.stepper.getTick();
    const state = this.registry.getOrCreate(sessionId, tick);

    if (this.isStaleSequence(state.current.sequence, sequence)) {
      return;
    }

    for (const [name, value] of Object.entries(inputs)) {
      this.setValue(sessionId, name, value, sequence);
    }

    state.current.sequence = sequence;
    state.current.updatedAtTick = tick;
  }

  setValue(
    sessionId: string,
    input: InputName,
    value: InputValue,
    sequence?: number,
  ): void {
    const tick = this.stepper.getTick();
    const state = this.registry.getOrCreate(sessionId, tick);

    if (this.isStaleSequence(state.current.sequence, sequence)) {
      return;
    }

    const previousValue = state.current.values.get(input);

    state.current.values.set(input, value);
    state.current.sequence = sequence;
    state.current.updatedAtTick = tick;

    if (!this.equals(previousValue, value)) {
      state.current.changedAtTick.set(input, tick);
    }
  }

  isDown(sessionId: string, input: InputName): boolean {
    return this.readBoolean(sessionId, input, 'current');
  }

  isUp(sessionId: string, input: InputName): boolean {
    return !this.isDown(sessionId, input);
  }

  wasPressed(sessionId: string, input: InputName): boolean {
    return (
      !this.readBoolean(sessionId, input, 'previous') &&
      this.readBoolean(sessionId, input, 'current')
    );
  }

  wasReleased(sessionId: string, input: InputName): boolean {
    return (
      this.readBoolean(sessionId, input, 'previous') &&
      !this.readBoolean(sessionId, input, 'current')
    );
  }

  getHeldTicks(sessionId: string, input: InputName): number {
    const state = this.registry.get(sessionId);
    if (!state) return 0;

    if (!this.isDown(sessionId, input)) return 0;

    const changedAtTick = state.current.changedAtTick.get(input);
    if (changedAtTick === undefined) return 0;

    return this.stepper.getTick() - changedAtTick;
  }

  getValue<T extends InputValue = InputValue>(
    sessionId: string,
    input: InputName,
  ): T | undefined {
    return this.registry.get(sessionId)?.current.values.get(input) as
      | T
      | undefined;
  }

  isStale(sessionId: string, maxTicks: number): boolean {
    const state = this.registry.get(sessionId);
    if (!state) return true;

    return this.stepper.getTick() - state.current.updatedAtTick > maxTicks;
  }

  commitFrame(): void {
    for (const state of this.registry.getAll()) {
      state.previous = {
        values: new Map(state.current.values),
        changedAtTick: new Map(state.current.changedAtTick),
        sequence: state.current.sequence,
        updatedAtTick: state.current.updatedAtTick,
      };
    }
  }

  clear(sessionId: string): void {
    this.registry.remove(sessionId);
  }

  private readBoolean(
    sessionId: string,
    input: InputName,
    frame: 'previous' | 'current',
  ): boolean {
    const state = this.registry.get(sessionId);
    if (!state) return false;

    return state[frame].values.get(input) === true;
  }

  private isStaleSequence(
    current: number | undefined,
    incoming: number | undefined,
  ): boolean {
    if (current === undefined || incoming === undefined) {
      return false;
    }

    return incoming < current;
  }

  private equals(a: InputValue | undefined, b: InputValue): boolean {
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return a === b;
  }
}
```

---

## Frame Commit System

The input system needs a fixed moment where `current` becomes `previous`.

Do not commit at the start of the tick. If you commit at the start, `wasPressed` and `wasReleased` can disappear before gameplay systems read them.

Recommended order:

```text
BEFORE_UPDATE
  - process session action queue
  - input handlers update current input state

UPDATE
  - gameplay systems query input
  - movement/attack/interact systems run

AFTER_UPDATE
  - input system commits current -> previous
```

### `engine-input.system.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_SESSIONS_DISCONNECT,
  OnAction,
} from '../engine-sessions';
import { OnAfterUpdate } from '../engine-decorators';
import { EngineInputManager } from './engine-input.manager';
import {
  InputEventPayload,
  InputSnapshotPayload,
} from './engine-input.types';

@Injectable()
export class EngineInputSystem {
  constructor(
    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  @OnAction('input.snapshot')
  onInputSnapshot({ sessionId, action }: {
    sessionId: string;
    action: InputSnapshotPayload;
  }): void {
    this.input.setSnapshot(sessionId, action.inputs, action.sequence);
  }

  @OnAction('input.event')
  onInputEvent({ sessionId, action }: {
    sessionId: string;
    action: InputEventPayload;
  }): void {
    this.input.setValue(
      sessionId,
      action.input,
      action.value,
      action.sequence,
    );
  }

  @OnAfterUpdate()
  onAfterUpdate(): void {
    this.input.commitFrame();
  }

  @OnEvent(ENGINE_SESSIONS_DISCONNECT)
  onSessionDisconnect(sessionId: string): void {
    this.input.clear(sessionId);
  }
}
```

---

## SDK Helpers

The current engine already uses SDK-style helpers such as `GetEntity()`, `UpdateEntity()`, `GetComponent()` and session helpers.

The input system can expose the same style.

### `engine-input.sdk.ts`

```ts
import { Container } from '../../../common/container';
import { EngineInputManager } from './engine-input.manager';
import { InputName, InputValue } from './engine-input.types';

export function IsInputDown(sessionId: string, input: InputName): boolean {
  return Container.get(EngineInputManager).isDown(sessionId, input);
}

export function WasInputPressed(sessionId: string, input: InputName): boolean {
  return Container.get(EngineInputManager).wasPressed(sessionId, input);
}

export function WasInputReleased(sessionId: string, input: InputName): boolean {
  return Container.get(EngineInputManager).wasReleased(sessionId, input);
}

export function GetInputValue<T extends InputValue = InputValue>(
  sessionId: string,
  input: InputName,
): T | undefined {
  return Container.get(EngineInputManager).getValue<T>(sessionId, input);
}

export function GetInputHeldTicks(sessionId: string, input: InputName): number {
  return Container.get(EngineInputManager).getHeldTicks(sessionId, input);
}

export function IsInputStale(sessionId: string, maxTicks: number): boolean {
  return Container.get(EngineInputManager).isStale(sessionId, maxTicks);
}
```

---

## Module

### `engine-input.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { EngineInputManager } from './engine-input.manager';
import { EngineInputRegistry } from './engine-input.registry';
import { EngineInputSystem } from './engine-input.system';

@Global()
@Module({
  providers: [
    EngineInputManager,
    EngineInputRegistry,
    EngineInputSystem,
  ],
  exports: [
    EngineInputManager,
    EngineInputRegistry,
  ],
})
export class EngineInputModule {}
```

### `index.ts`

```ts
export * from './engine-input.types';
export * from './engine-input.manager';
export * from './engine-input.registry';
export * from './engine-input.system';
export * from './engine-input.sdk';
export * from './engine-input.module';
```

### Update `engine.module.ts`

```ts
import { EngineInputModule } from './engine-input';

@Module({
  imports: [
    EngineCollisionsModule,
    EngineEntitiesModule,
    EngineStateMachineModule,
    EngineSessionsModule,
    EngineInputModule,
    EngineChunksModule,
    EngineDebugModule,
    EngineStoreModule,
  ],
  providers: [Engine, EngineStepper],
  exports: [Engine, EngineStepper],
})
export class EngineModule {}
```

---

## Runtime Flow

### Client input snapshot

1. frontend reads keyboard/controller state
2. frontend maps physical controls into semantic input names
3. frontend sends `input.snapshot`
4. backend queues the action in the session
5. `EngineSessionSystem` emits `session.action.input.snapshot` during `BEFORE_UPDATE`
6. `EngineInputSystem` writes values into `EngineInputManager.current`
7. gameplay systems read input during `UPDATE`
8. `EngineInputSystem` commits `current` into `previous` during `AFTER_UPDATE`

---

## Movement Usage

The movement system should stop listening directly to `move` actions.

Instead, it should run on update and query input.

### Example `GamePlayersMovementSystem`

```ts
import { Inject, Injectable } from '@nestjs/common';
import { OnUpdate } from '../../lib/engine/engine-decorators';
import { EngineInputManager } from '../../lib/engine/engine-input';
import { EngineEntitiesRegistry } from '../../lib/engine/engine-entities/engine-entities.registry';
import { WouldCollideAt } from '../../lib/engine/engine-collisions';
import { UpdateEntity } from '../../lib/engine/engine-entities';
import { Vector3 } from 'three';
import { Player } from './player.entity';

const INPUT_STALE_TICKS = 10;

@Injectable()
export class GamePlayersMovementSystem {
  constructor(
    @Inject(EngineEntitiesRegistry)
    private readonly entities: EngineEntitiesRegistry,

    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  @OnUpdate()
  onUpdate(): void {
    for (const entity of this.entities.getAll()) {
      if (!entity.tags.includes('player')) continue;

      const player = entity as Player;
      if (!player.sessionId) continue;

      if (this.input.isStale(player.sessionId, INPUT_STALE_TICKS)) {
        continue;
      }

      const direction = this.getMovementDirection(player.sessionId);
      if (direction.lengthSq() === 0) {
        continue;
      }

      const delta = direction.multiplyScalar(player.speed);
      const futurePosition = player.position.clone().add(delta);

      if (WouldCollideAt(player.id, futurePosition)) {
        continue;
      }

      player.move(delta);
      UpdateEntity(player);
    }
  }

  private getMovementDirection(sessionId: string): Vector3 {
    const direction = new Vector3(0, 0, 0);

    if (this.input.isDown(sessionId, 'move.up')) {
      direction.y -= 1;
    }

    if (this.input.isDown(sessionId, 'move.down')) {
      direction.y += 1;
    }

    if (this.input.isDown(sessionId, 'move.left')) {
      direction.x -= 1;
    }

    if (this.input.isDown(sessionId, 'move.right')) {
      direction.x += 1;
    }

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    return direction;
  }
}
```

This keeps movement as simulation code, not network-input code.

---

## Press And Release Usage

This is the main benefit of the system.

### Dash

```ts
if (this.input.wasPressed(player.sessionId, 'dash')) {
  // start dash once
}
```

### Charged attack

```ts
if (this.input.isDown(player.sessionId, 'attack.primary')) {
  // increase charge
}

if (this.input.wasReleased(player.sessionId, 'attack.primary')) {
  // fire charged attack
}
```

### Interaction

```ts
if (this.input.wasPressed(player.sessionId, 'interact')) {
  // interact once with nearest object
}
```

---

## Why Commit On `AFTER_UPDATE`

The engine currently runs phases in this order:

```text
BEFORE_UPDATE
UPDATE
AFTER_UPDATE
BEFORE_RENDER
RENDER
AFTER_RENDER
```

Input actions are already processed in `BEFORE_UPDATE`.

That makes `AFTER_UPDATE` the correct place to commit the frame.

If input is committed before `UPDATE`, then `previous` and `current` become equal too early and `wasPressed`/`wasReleased` will not work.

Correct lifecycle:

```text
Tick N:
  BEFORE_UPDATE: input changes current
  UPDATE: systems read previous vs current
  AFTER_UPDATE: current becomes previous

Tick N + 1:
  BEFORE_UPDATE: new input changes current
  UPDATE: systems read previous vs current
  AFTER_UPDATE: current becomes previous
```

---

## Snapshot vs Event Input

There are two valid client protocols.

### Option A: Snapshot input

The client sends the full input state periodically.

```ts
{
  type: 'input.snapshot',
  sequence: 10,
  inputs: {
    'move.up': false,
    'move.down': false,
    'move.left': true,
    'move.right': false,
    'attack.primary': true,
  },
}
```

Pros:

- resilient to lost release events
- simple server state
- good for movement

Cons:

- sends more data
- needs client throttle, usually 20-60 times per second

Recommended for the first version.

---

### Option B: Event input

The client sends only changes.

```ts
{
  type: 'input.event',
  sequence: 11,
  input: 'attack.primary',
  value: true,
}
```

Pros:

- less network traffic
- good for discrete actions

Cons:

- lost release events can leave inputs stuck
- requires heartbeat, sequence handling or periodic correction snapshots

Recommended later, combined with periodic snapshots.

---

## Recommended First Version

Start with snapshot input only.

Do not start with a complex prediction/reconciliation layer.

Suggested first payload:

```ts
export type InputSnapshotAction = {
  type: 'input.snapshot';
  sequence?: number;
  inputs: {
    'move.up': boolean;
    'move.down': boolean;
    'move.left': boolean;
    'move.right': boolean;
    'attack.primary'?: boolean;
    'interact'?: boolean;
    'dash'?: boolean;
  };
};
```

Then add `input.event` only when there is a real reason.

---

## What Happens To The Current `move` Action

The current `move` action should be replaced or adapted.

### Option 1: Replace it

Frontend stops sending:

```ts
{ type: 'move', up, down, left, right }
```

And starts sending:

```ts
{
  type: 'input.snapshot',
  inputs: {
    'move.up': up,
    'move.down': down,
    'move.left': left,
    'move.right': right,
  }
}
```

This is cleaner.

---

### Option 2: Keep compatibility temporarily

Add a compatibility handler:

```ts
@OnAction('move')
onLegacyMove({ sessionId, action }: MoveAction): void {
  this.input.setSnapshot(sessionId, {
    'move.up': action.up,
    'move.down': action.down,
    'move.left': action.left,
    'move.right': action.right,
  });
}
```

This allows the backend to move to the new input system before the frontend changes.

---

## Stale Input Rules

Input should be considered stale when the session has not sent updates for a configured number of ticks.

Recommended starting value:

```ts
const INPUT_STALE_TICKS = 10;
```

At 60 ticks per second, that is roughly 166ms.
At 20 ticks per second, that is roughly 500ms.

When input is stale:

- movement should stop
- charged actions should cancel or resolve depending on game design
- held inputs should be ignored

Do not keep moving forever based on the last received input.

---

## Multiplayer Considerations

Input state must be keyed by `sessionId`, not by entity id.

Reason:

- input belongs to a connected player/session
- entities can be recreated
- one session may control different entities later
- spectator or possession systems become easier later

Gameplay systems can bridge from entity to session:

```ts
if (!player.sessionId) return;

this.input.isDown(player.sessionId, 'move.up');
```

---

## Testing Plan

### Unit tests for `EngineInputManager`

Test cases:

1. `isDown()` returns true after setting input to true
2. `isUp()` returns true when input is missing or false
3. `wasPressed()` returns true only on false -> true transition
4. `wasReleased()` returns true only on true -> false transition
5. `commitFrame()` copies current into previous
6. `getHeldTicks()` increases while input stays down
7. stale sequence numbers are ignored
8. `isStale()` returns true after max tick threshold
9. `clear()` removes session input state

---

### Integration tests

Test cases:

1. pushing `input.snapshot` updates input before `UPDATE`
2. systems can read `wasPressed()` during `UPDATE`
3. `wasPressed()` is false after `AFTER_UPDATE` commit
4. disconnect removes input state
5. movement system stops when input becomes stale

---

## File Structure

```text
src/lib/engine/engine-input/
├── engine-input.types.ts
├── engine-input.manager.ts
├── engine-input.registry.ts
├── engine-input.system.ts
├── engine-input.sdk.ts
├── engine-input.module.ts
└── index.ts

src/game/game-players/
├── game-players.movement.system.ts
├── game-players.input-compat.system.ts optional
└── game-players.actions.ts updated
```

---

## Migration Order

1. create `src/lib/engine/engine-input/engine-input.types.ts`
2. create `EngineInputRegistry`
3. create `EngineInputManager`
4. create `EngineInputSystem`
5. create `engine-input.sdk.ts`
6. create `EngineInputModule`
7. import `EngineInputModule` into `EngineModule`
8. add `input.snapshot` action support
9. optionally add legacy `move` compatibility handler
10. update movement to read input during `@OnUpdate()`
11. remove direct movement from `GamePlayersSystem.onMoveAction()`
12. add unit tests for pressed/released/held/stale behavior

---

## Final Recommendation

The input system should become a first-class engine subsystem, not a player-specific component.

The best first version is:

```text
input.snapshot action
  -> EngineInputManager current state
    -> gameplay systems query during UPDATE
      -> EngineInputSystem commits current to previous during AFTER_UPDATE
```

This gives the engine a stable input API:

```ts
isDown()
wasPressed()
wasReleased()
getHeldTicks()
isStale()
```

And keeps gameplay systems independent from socket payloads.

That is the right foundation for movement, dash, attack, interact, charging, menus and future controller support.
