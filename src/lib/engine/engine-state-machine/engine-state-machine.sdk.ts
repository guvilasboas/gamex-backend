import { EngineStateMachineDefinitionsRegistry } from './engine-state-machine-definitions.registry';
import { EngineStateMachineManager } from './engine-state-machine.manager';
import { StateMachineComponent } from './state-machine.component';
import { Container } from '../../../common/container';
import {
  StateId,
  StateMachineDefinition,
  TransitionApplyResult,
  TransitionId,
} from './engine-state-machine.types';

export function RegisterStateMachine<TContext>(
  definition: StateMachineDefinition<TContext>,
): void {
  const registry = Container.get<EngineStateMachineDefinitionsRegistry>(
    EngineStateMachineDefinitionsRegistry,
  );

  registry.register(definition);
}

export function CreateStateMachine<TContext>(
  entityId: string,
  definitionId: string,
  params: { id: string; context?: TContext },
): StateMachineComponent<TContext> {
  const manager = Container.get<EngineStateMachineManager>(
    EngineStateMachineManager,
  );

  return manager.create(entityId, definitionId, params);
}

export function RequestTransition(
  entityId: string,
  machineId: string,
  transitionId: TransitionId,
): TransitionApplyResult {
  const manager = Container.get<EngineStateMachineManager>(
    EngineStateMachineManager,
  );

  return manager.requestTransition(entityId, machineId, transitionId);
}

export function Transition(
  entityId: string,
  machineId: string,
  transitionId: TransitionId,
): boolean {
  const result = RequestTransition(entityId, machineId, transitionId);
  return result.code === 'applied' || result.code === 'queued';
}

export function ForceState(
  entityId: string,
  machineId: string,
  nextState: StateId,
): TransitionApplyResult {
  const manager = Container.get<EngineStateMachineManager>(
    EngineStateMachineManager,
  );

  return manager.forceState(entityId, machineId, nextState);
}

export function SuspendStateMachine(
  entityId: string,
  machineId: string,
): boolean {
  const manager = Container.get<EngineStateMachineManager>(
    EngineStateMachineManager,
  );
  return manager.suspend(entityId, machineId);
}

export function ResumeStateMachine(
  entityId: string,
  machineId: string,
): boolean {
  const manager = Container.get<EngineStateMachineManager>(
    EngineStateMachineManager,
  );
  return manager.resume(entityId, machineId);
}

export function GetStateMachine<TContext = unknown>(
  entityId: string,
  machineId: string,
): StateMachineComponent<TContext> | undefined {
  const manager = Container.get<EngineStateMachineManager>(
    EngineStateMachineManager,
  );
  return manager.get(entityId, machineId);
}

export function GetCurrentState(
  entityId: string,
  machineId: string,
): StateId | undefined {
  return GetStateMachine(entityId, machineId)?.currentState;
}

export function PatchStateMachineContext<TContext>(
  entityId: string,
  machineId: string,
  patch: Partial<TContext>,
): boolean {
  const manager = Container.get<EngineStateMachineManager>(
    EngineStateMachineManager,
  );
  return manager.patchContext(entityId, machineId, patch);
}
