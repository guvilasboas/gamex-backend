import { Inject, Injectable } from '@nestjs/common';
import { EngineStepper } from '../engine-stepper';
import { EngineInputRegistry } from './engine-input.registry';
import { InputName, InputValue } from './engine-input.types';

const MAX_INPUTS = 32;

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

  private validateSnapshot(inputs: Record<InputName, InputValue>): boolean {
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
