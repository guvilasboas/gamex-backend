import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DispatchedSessionAction } from '../engine-sessions';
import { ENGINE_SESSIONS_DISCONNECT, OnAction } from '../engine-sessions';
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
