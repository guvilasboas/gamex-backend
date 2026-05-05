import {
  DispatchedSessionAction,
  SessionAction,
} from '../../lib/engine/engine-sessions';

export type MoveActionPayload = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type MoveAction = DispatchedSessionAction<
  MoveActionPayload & SessionAction
>;
