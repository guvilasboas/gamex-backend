import { Container } from '../../../common/container';
import { EngineInputManager } from './engine-input.manager';
import { InputName, InputValue } from './engine-input.types';

export function IsInputDown(sessionId: string, input: InputName): boolean {
  return Container.get<EngineInputManager>(EngineInputManager).isDown(
    sessionId,
    input,
  );
}

export function WasInputPressed(sessionId: string, input: InputName): boolean {
  return Container.get<EngineInputManager>(EngineInputManager).wasPressed(
    sessionId,
    input,
  );
}

export function WasInputReleased(sessionId: string, input: InputName): boolean {
  return Container.get<EngineInputManager>(EngineInputManager).wasReleased(
    sessionId,
    input,
  );
}

export function GetInputValue<T extends InputValue = InputValue>(
  sessionId: string,
  input: InputName,
): T | undefined {
  return Container.get<EngineInputManager>(EngineInputManager).getValue<T>(
    sessionId,
    input,
  );
}

export function GetInputHeldTicks(sessionId: string, input: InputName): number {
  return Container.get<EngineInputManager>(EngineInputManager).getHeldTicks(
    sessionId,
    input,
  );
}

export function IsInputStale(sessionId: string, maxTicks: number): boolean {
  return Container.get<EngineInputManager>(EngineInputManager).isStale(
    sessionId,
    maxTicks,
  );
}
