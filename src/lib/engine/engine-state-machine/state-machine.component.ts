import { ComponentType } from '../engine-entities/engine-entities-components/component-type.decorator';
import { Component } from '../engine-entities/engine-entities-components/component';
import {
  StateId,
  StateMachineDefinitionId,
} from './engine-state-machine.types';

@ComponentType('state-machine')
export class StateMachineComponent<TContext = unknown> extends Component {
  static readonly type = 'state-machine';

  definitionId: StateMachineDefinitionId;
  currentState: StateId;
  previousState?: StateId;
  stateEnteredAt = 0;
  context: TContext;
  suspended = false;
  revision = 0;
}
