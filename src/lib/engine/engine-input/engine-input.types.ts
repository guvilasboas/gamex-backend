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
