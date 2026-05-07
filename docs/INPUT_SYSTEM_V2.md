# Input System V2

## Changes from V1

This document refines V1 with the following corrections and improvements:

1. **Bug: `setSnapshot` chamava `setValue` internamente em loop** — `setValue` atualizava `state.current.sequence` a cada iteração, causando mutação de estado no meio do loop. V2 escreve os valores diretamente.

2. **Performance: `commitFrame` alocava novos Maps a cada tick** — Em 20 ticks/s com 100 sessões, isso gera 4000 alocações de `Map` por segundo. V2 reutiliza os objetos `Map` existentes.

3. **Segurança: payloads de input chegam do cliente sem validação** — Sem verificação, um cliente pode enviar nomes de input com prototype pollution (`__proto__`, `constructor`) ou valores inválidos. V2 valida no ponto de ingestão.

4. **`previous.changedAtTick` era copiado sem nunca ser lido** — Nenhuma query do manager usa `previous.changedAtTick`. V2 remove a cópia desnecessária.

5. **Tipos de ação usavam assinatura inline** — V1 usava `{ sessionId: string; action: ... }` inline nos handlers. V2 usa `DispatchedSessionAction<T>` consistente com o restante do codebase (ex: `MoveAction`).

6. **`InputSnapshotPayload` e `InputEventPayload` não extendiam `SessionAction`** — V2 define `InputSnapshotAction` e `InputEventAction` como tipos de action próprios, alinhados com o pattern do `SessionAction`.

7. **`GamePlayersMovementSystem` omitia o gerenciamento de tags** — O sistema atual controla tags `idle`/`walking`. V2 mantém esse comportamento, inclusive quando o input está stale.

8. **Adicionado `engine-input.events.ts`** — Consistência com outros módulos do engine.

---

## Architecture Summary

A mesma stack de 4 camadas do V1 é mantida:

```text
socket action
  -> session action queue
    -> EngineInputSystem (OnAction handler)
      -> EngineInputManager (current frame state)
        -> gameplay systems read input during UPDATE
          -> EngineInputSystem commits current -> previous on AFTER_UPDATE
```

Lifecycle por tick:

```text
Tick N:
  BEFORE_UPDATE:
    - EngineSessionSystem drena a fila de actions e emite eventos
    - EngineInputSystem.onInputSnapshot() atualiza EngineInputManager.current

  UPDATE:
    - Sistemas de gameplay leem previous vs current
    - isDown / wasPressed / wasReleased funcionam corretamente

  AFTER_UPDATE:
    - EngineInputSystem.onAfterUpdate() comita current → previous
```

---

## File Structure

```text
src/lib/engine/engine-input/
├── engine-input.events.ts       (novo)
├── engine-input.types.ts        (atualizado)
├── engine-input.manager.ts      (atualizado)
├── engine-input.registry.ts     (sem mudanças)
├── engine-input.system.ts       (atualizado)
├── engine-input.sdk.ts          (sem mudanças)
├── engine-input.module.ts       (sem mudanças)
└── index.ts                     (atualizado)

src/game/game-players/
├── game-players.movement.system.ts   (novo)
├── game-players.input-compat.system.ts  (opcional)
└── game-players.system.ts            (remover movimento daqui)
```

---

## Core Types

### `engine-input.types.ts`

```ts
import { SessionAction } from '../engine-sessions';

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

// Tipos de action alinhados com SessionAction do codebase
export type InputSnapshotAction = SessionAction & {
  type: 'input.snapshot';
  sequence?: number;
  inputs: Record<InputName, InputValue>;
};

export type InputEventAction = SessionAction & {
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

**Diferença do V1:** `InputSnapshotPayload` e `InputEventPayload` foram renomeados para `InputSnapshotAction` e `InputEventAction`, agora com `& SessionAction`. Isso alinha com o pattern `MoveAction = DispatchedSessionAction<MoveActionPayload & SessionAction>` já usado no codebase.

---

## Events

### `engine-input.events.ts`

```ts
export const ENGINE_INPUT_FRAME_COMMITTED = 'engine.input.frame_committed';
```

Evento emitido após `commitFrame()`. Permite que outros sistemas reajam ao fim do ciclo de input sem acoplar ao `EngineInputSystem` diretamente. Não é usado internamente — fica disponível para extensão futura.

---

## Registry

### `engine-input.registry.ts`

Sem mudanças em relação ao V1.

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

Três correções principais em relação ao V1:

1. `setSnapshot` escreve valores diretamente (não chama `setValue` em loop)
2. `commitFrame` reutiliza os objetos `Map` existentes (sem alocação por tick)
3. Validação de payload adicionada em `setSnapshot` e `setValue`

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
    if (!this.validateSnapshot(inputs)) {
      return;
    }

    const tick = this.stepper.getTick();
    const state = this.registry.getOrCreate(sessionId, tick);

    if (this.isStaleSequence(state.current.sequence, sequence)) {
      return;
    }

    // Escreve diretamente sem chamar setValue em loop
    // para evitar mutação de state.current.sequence no meio do loop
    for (const [name, value] of Object.entries(inputs)) {
      const previous = state.current.values.get(name);
      state.current.values.set(name, value);

      if (!this.equals(previous, value)) {
        state.current.changedAtTick.set(name, tick);
      }
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
    if (!this.validateInput(input, value)) {
      return;
    }

    const tick = this.stepper.getTick();
    const state = this.registry.getOrCreate(sessionId, tick);

    if (this.isStaleSequence(state.current.sequence, sequence)) {
      return;
    }

    const previous = state.current.values.get(input);
    state.current.values.set(input, value);
    state.current.sequence = sequence;
    state.current.updatedAtTick = tick;

    if (!this.equals(previous, value)) {
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

  /**
   * Copia current em previous reutilizando os objetos Map existentes.
   *
   * V1 criava `new Map(...)` a cada tick, gerando GC pressure proporcional
   * ao número de sessões. V2 faz clear + copy nos Maps existentes.
   *
   * previous.changedAtTick não é copiado porque nenhum método o lê
   * a partir de previous. Apenas current.changedAtTick é consultado
   * (por getHeldTicks).
   */
  commitFrame(): void {
    for (const state of this.registry.getAll()) {
      state.previous.values.clear();

      for (const [key, value] of state.current.values) {
        state.previous.values.set(key, value);
      }

      state.previous.sequence = state.current.sequence;
      state.previous.updatedAtTick = state.current.updatedAtTick;
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

  /**
   * Valida um snapshot completo vindo do cliente.
   * Limita a quantidade de inputs e rejeita nomes reservados do prototype.
   */
  private validateSnapshot(inputs: Record<InputName, InputValue>): boolean {
    const MAX_INPUTS = 32;
    const keys = Object.keys(inputs);

    if (keys.length > MAX_INPUTS) {
      return false;
    }

    for (const key of keys) {
      if (!this.validateInput(key, inputs[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Valida um par nome/valor individual.
   * Bloqueia prototype pollution e valores não esperados.
   */
  private validateInput(name: InputName, value: InputValue): boolean {
    if (
      name === '__proto__' ||
      name === 'constructor' ||
      name === 'prototype'
    ) {
      return false;
    }

    const type = typeof value;

    if (type !== 'boolean' && type !== 'number') {
      return false;
    }

    if (type === 'number' && !isFinite(value as number)) {
      return false;
    }

    return true;
  }
}
```

---

## Input System

### `engine-input.system.ts`

Diferenças do V1:

- Handlers usam `DispatchedSessionAction<InputSnapshotAction>` ao invés de tipo inline
- Importação de `OnAction` e `ENGINE_SESSIONS_DISCONNECT` vem de `'../engine-sessions'` (consistente com os outros sistemas do engine)

```ts
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_SESSIONS_DISCONNECT,
  OnAction,
  DispatchedSessionAction,
} from '../engine-sessions';
import { OnAfterUpdate } from '../engine-decorators';
import { EngineInputManager } from './engine-input.manager';
import { InputEventAction, InputSnapshotAction } from './engine-input.types';

@Injectable()
export class EngineInputSystem {
  constructor(
    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  @OnAction('input.snapshot')
  onInputSnapshot({
    sessionId,
    action,
  }: DispatchedSessionAction<InputSnapshotAction>): void {
    this.input.setSnapshot(sessionId, action.inputs, action.sequence);
  }

  @OnAction('input.event')
  onInputEvent({
    sessionId,
    action,
  }: DispatchedSessionAction<InputEventAction>): void {
    this.input.setValue(sessionId, action.input, action.value, action.sequence);
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

### `engine-input.sdk.ts`

Sem mudanças em relação ao V1.

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

Sem mudanças em relação ao V1.

```ts
import { Global, Module } from '@nestjs/common';
import { EngineInputManager } from './engine-input.manager';
import { EngineInputRegistry } from './engine-input.registry';
import { EngineInputSystem } from './engine-input.system';

@Global()
@Module({
  providers: [EngineInputManager, EngineInputRegistry, EngineInputSystem],
  exports: [EngineInputManager, EngineInputRegistry],
})
export class EngineInputModule {}
```

### `index.ts`

```ts
export * from './engine-input.events';
export * from './engine-input.types';
export * from './engine-input.manager';
export * from './engine-input.registry';
export * from './engine-input.system';
export * from './engine-input.sdk';
export * from './engine-input.module';
```

---

## Update `engine.module.ts`

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

## Movement System

### `game-players.movement.system.ts`

V1 omitia o gerenciamento de tags `idle`/`walking`. V2 restaura esse comportamento e também reseta para idle quando o input está stale (ao invés de simplesmente pular o update).

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

const WALKING_TAG = 'walking';
const IDLE_TAG = 'idle';

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

      // Input stale: para o jogador e sinaliza idle
      if (this.input.isStale(player.sessionId, INPUT_STALE_TICKS)) {
        this.syncMovementTags(player, false);
        UpdateEntity(player);
        continue;
      }

      const direction = this.getMovementDirection(player.sessionId);
      const isMoving = direction.lengthSq() > 0;

      this.syncMovementTags(player, isMoving);

      if (isMoving) {
        const delta = direction.multiplyScalar(player.speed);
        const futurePosition = player.position.clone().add(delta);

        if (!WouldCollideAt(player.id, futurePosition)) {
          player.move(delta);
        }
      }

      UpdateEntity(player);
    }
  }

  private getMovementDirection(sessionId: string): Vector3 {
    const direction = new Vector3(0, 0, 0);

    if (this.input.isDown(sessionId, 'move.up')) direction.y -= 1;
    if (this.input.isDown(sessionId, 'move.down')) direction.y += 1;
    if (this.input.isDown(sessionId, 'move.left')) direction.x -= 1;
    if (this.input.isDown(sessionId, 'move.right')) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    return direction;
  }

  private syncMovementTags(player: Player, isMoving: boolean): void {
    if (isMoving) {
      player.addTag(WALKING_TAG);
      player.removeTag(IDLE_TAG);
    } else {
      player.addTag(IDLE_TAG);
      player.removeTag(WALKING_TAG);
    }
  }
}
```

---

## Legacy Compatibility (opcional)

Se o frontend ainda envia o formato `{ type: 'move', up, down, left, right }`, adicionar um sistema de compatibilidade separado enquanto a migração do cliente não é feita:

### `game-players.input-compat.system.ts`

```ts
import { Injectable, Inject } from '@nestjs/common';
import { OnAction } from '../../lib/engine/engine-sessions';
import { EngineInputManager } from '../../lib/engine/engine-input';
import { type MoveAction } from './game-players.actions';

@Injectable()
export class GamePlayersInputCompatSystem {
  constructor(
    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  @OnAction('move')
  onLegacyMove({ sessionId, action }: MoveAction): void {
    this.input.setSnapshot(sessionId, {
      'move.up': action.up,
      'move.down': action.down,
      'move.left': action.left,
      'move.right': action.right,
    });
  }
}
```

Registrar em `game-players.module.ts` e remover quando o cliente migrar para `input.snapshot`.

---

## Caveats Conhecidos

### Sequence number wrap-around

`isStaleSequence` usa comparação simples `incoming < current`. Se o cliente usar números de sequência que façam wrap-around (ex: uint16 voltando de 65535 para 0), a comparação rejeitaria snapshots válidos. Para V2 isso não é um problema prático — documentar e resolver apenas quando necessário.

### `getHeldTicks` com input pré-existente

Se um input já estava `true` antes do sistema começar a rastrear a sessão (ex: reconexão com estado parcialmente restaurado), `changedAtTick` será `undefined` e `getHeldTicks` retornará 0. Comportamento esperado para V2.

### `wasPressed` em input digital apenas

`wasPressed` e `wasReleased` funcionam apenas para valores booleanos. Para analog/vector, usar `getValue` e comparar manualmente. Documentar isso nas docs de API quando analog for adicionado.

---

## Testing Plan

### Unit tests para `EngineInputManager`

```text
1. isDown() retorna true após setSnapshot com valor true
2. isUp() retorna true quando input está ausente ou false
3. wasPressed() retorna true apenas na transição false -> true
4. wasReleased() retorna true apenas na transição true -> false
5. wasPressed() retorna false após commitFrame sem nova mudança
6. commitFrame() não aloca novos objetos Map (verificar referências)
7. getHeldTicks() incrementa enquanto input permanece down
8. sequence stale é rejeitado em setSnapshot
9. sequence stale é rejeitado em setValue
10. isStale() retorna true após exceder maxTicks sem update
11. clear() remove o estado da sessão
12. validateSnapshot() rejeita __proto__ como input name
13. validateSnapshot() rejeita mais de 32 inputs
14. validateSnapshot() rejeita valores não booleanos/numéricos
15. validateSnapshot() rejeita Infinity e NaN como valores numéricos
```

### Integration tests

```text
1. pushAction('input.snapshot') atualiza input antes do UPDATE
2. sistemas podem ler wasPressed() durante UPDATE
3. wasPressed() retorna false após AFTER_UPDATE commit
4. disconnect remove o estado de input
5. sistema de movimento para quando input fica stale
6. sistema de movimento aplica tag idle quando input fica stale
7. compat handler converte move action para input snapshot corretamente
```

---

## Migration Order

1. criar `engine-input.events.ts`
2. criar `engine-input.types.ts`
3. criar `EngineInputRegistry`
4. criar `EngineInputManager`
5. criar `EngineInputSystem`
6. criar `engine-input.sdk.ts`
7. criar `EngineInputModule`
8. criar `index.ts`
9. importar `EngineInputModule` em `EngineModule`
10. criar `GamePlayersMovementSystem`
11. criar `GamePlayersInputCompatSystem` (se necessário)
12. remover lógica de movimento de `GamePlayersSystem.onMoveAction()`
13. registrar `GamePlayersMovementSystem` em `game-players.module.ts`
14. escrever unit tests para `EngineInputManager`
15. escrever integration tests
16. migrar frontend para `input.snapshot` e remover compat system
