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
