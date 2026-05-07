import { Injectable } from '@nestjs/common';
import { StateMachineDefinition } from './engine-state-machine.types';

@Injectable()
export class EngineStateMachineDefinitionsRegistry {
  private readonly definitions = new Map<string, StateMachineDefinition<any>>();

  register<TContext>(definition: StateMachineDefinition<TContext>): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(
        `State machine definition already registered: ${definition.id}`,
      );
    }

    this.validateDefinition(definition);
    this.definitions.set(definition.id, definition);
  }

  get<TContext>(id: string): StateMachineDefinition<TContext> | undefined {
    return this.definitions.get(id) as
      | StateMachineDefinition<TContext>
      | undefined;
  }

  private validateDefinition<TContext>(
    definition: StateMachineDefinition<TContext>,
  ): void {
    if (!definition.states[definition.initialState]) {
      throw new Error(
        `Initial state not found in definition: ${definition.id}`,
      );
    }

    for (const state of Object.values(definition.states)) {
      for (const transition of Object.values(state.transitions ?? {})) {
        if (!definition.states[transition.to]) {
          throw new Error(
            `Transition target "${transition.to}" not found in definition: ${definition.id}`,
          );
        }
      }
    }
  }
}
