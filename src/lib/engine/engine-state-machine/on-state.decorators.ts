import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_SM_ENTER_EVENT,
  ENGINE_SM_EXIT_EVENT,
  ENGINE_SM_FINALIZED_EVENT,
  ENGINE_SM_RESUMED_EVENT,
  ENGINE_SM_SUSPENDED_EVENT,
  ENGINE_SM_TRANSITION_BLOCKED_EVENT,
  ENGINE_SM_UPDATE_EVENT,
} from './engine-state-machine.events';
import {
  StateId,
  StateMachineBlockedPayload,
  StateMachineLifecyclePayload,
  StateMachineTransitionPayload,
  StateMachineUpdatePayload,
} from './engine-state-machine.types';

export type StateEventFilter = {
  machineId?: string;
  definitionId?: string;
  state?: StateId;
  entityType?: string;
  entityTag?: string;
  suspended?: boolean;
};

type StateEventPayload =
  | StateMachineTransitionPayload
  | StateMachineUpdatePayload
  | StateMachineBlockedPayload
  | StateMachineLifecyclePayload;

function getEventState(payload: StateEventPayload): StateId | undefined {
  if ('to' in payload) return payload.to;
  return payload.machine.currentState;
}

function matchesFilter(
  payload: StateEventPayload,
  filter: StateEventFilter,
): boolean {
  if (filter.machineId && payload.machine.machineId !== filter.machineId) {
    return false;
  }
  if (
    filter.definitionId &&
    payload.machine.definitionId !== filter.definitionId
  ) {
    return false;
  }

  const activeState = getEventState(payload);
  if (filter.state && activeState !== filter.state) {
    return false;
  }

  if (filter.entityType && payload.entity.type !== filter.entityType) {
    return false;
  }
  if (filter.entityTag && !payload.entity.tags.includes(filter.entityTag)) {
    return false;
  }
  if (
    filter.suspended !== undefined &&
    payload.machine.suspended !== filter.suspended
  ) {
    return false;
  }

  return true;
}

function makeStateDecorator(eventName: string) {
  return (filter?: StateEventFilter): MethodDecorator =>
    (target, propertyKey, descriptor: PropertyDescriptor) => {
      if (filter) {
        const original = descriptor.value as (
          payload: StateEventPayload,
        ) => unknown;
        descriptor.value = function (payload: StateEventPayload) {
          if (!matchesFilter(payload, filter)) return;
          return original.call(this, payload);
        };
      }

      OnEvent(eventName)(target, propertyKey, descriptor);
    };
}

export const OnStateEnter = makeStateDecorator(ENGINE_SM_ENTER_EVENT);
export const OnStateExit = makeStateDecorator(ENGINE_SM_EXIT_EVENT);
export const OnStateUpdate = makeStateDecorator(ENGINE_SM_UPDATE_EVENT);
export const OnStateBlocked = makeStateDecorator(
  ENGINE_SM_TRANSITION_BLOCKED_EVENT,
);
export const OnStateSuspended = makeStateDecorator(ENGINE_SM_SUSPENDED_EVENT);
export const OnStateResumed = makeStateDecorator(ENGINE_SM_RESUMED_EVENT);
export const OnStateFinalized = makeStateDecorator(ENGINE_SM_FINALIZED_EVENT);
