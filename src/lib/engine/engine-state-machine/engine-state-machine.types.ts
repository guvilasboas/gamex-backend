import type { Entity } from '../engine-entities';
import type { StateMachineComponent } from './state-machine.component';

export type StateId = string;
export type StateMachineDefinitionId = string;
export type TransitionId = string;

export type TransitionGuardContext<TContext = unknown> = {
  entity: Entity;
  machine: StateMachineComponent<TContext>;
  context: TContext;
};

export type TransitionGuard<TContext = unknown> = (
  args: TransitionGuardContext<TContext>,
) => boolean;

export type StateTransition<TContext = unknown> = {
  to: StateId;
  guard?: TransitionGuard<TContext>;
};

export type StateDefinition<TContext = unknown> = {
  id: StateId;
  transitions?: Record<TransitionId, StateTransition<TContext>>;
};

export type StateMachineDefinition<TContext = unknown> = {
  id: StateMachineDefinitionId;
  initialState: StateId;
  states: Record<StateId, StateDefinition<TContext>>;
};

export type TransitionApplyResultCode =
  | 'applied'
  | 'queued'
  | 'missing-entity'
  | 'missing-machine'
  | 'missing-definition'
  | 'missing-state'
  | 'missing-transition'
  | 'guard-blocked'
  | 'suspended';

export type TransitionApplyResult = {
  code: TransitionApplyResultCode;
  entityId: string;
  machineId: string;
  transitionId: TransitionId;
  from?: StateId;
  to?: StateId;
};

export type StateMachineIntent =
  | {
      kind: 'transition';
      entityId: string;
      machineId: string;
      transitionId: TransitionId;
      tick: number;
      result?: TransitionApplyResult;
    }
  | {
      kind: 'force';
      entityId: string;
      machineId: string;
      nextState: StateId;
      tick: number;
      result?: TransitionApplyResult;
    };

export type StateMachineEventEntitySnapshot = {
  id: string;
  type?: string;
  tags: string[];
};

export type StateMachineRuntimeSnapshot<TContext = unknown> = {
  entityId: string;
  machineId: string;
  definitionId: StateMachineDefinitionId;
  currentState: StateId;
  previousState?: StateId;
  stateEnteredAt: number;
  suspended: boolean;
  revision: number;
  context: TContext;
};

export type StateMachineTransitionPayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machine: StateMachineRuntimeSnapshot<TContext>;
  from?: StateId;
  to: StateId;
  transitionId?: TransitionId;
  tick: number;
};

export type StateMachineBlockedPayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machine: StateMachineRuntimeSnapshot<TContext>;
  transitionId: TransitionId;
  reason: Exclude<TransitionApplyResultCode, 'applied' | 'queued'>;
  tick: number;
};

export type StateMachineUpdatePayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machine: StateMachineRuntimeSnapshot<TContext>;
  tick: number;
  deltaMs: number;
};

export type StateMachineLifecyclePayload<TContext = unknown> = {
  entity: StateMachineEventEntitySnapshot;
  machine: StateMachineRuntimeSnapshot<TContext>;
  tick?: number;
};
