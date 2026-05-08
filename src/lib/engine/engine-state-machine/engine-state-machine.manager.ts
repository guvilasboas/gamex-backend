import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EngineEntitiesComponentsManager,
  Component,
} from '../engine-entities/engine-entities-components';
import {
  EngineEntitiesRegistry,
  Entity,
  GetEntityType,
} from '../engine-entities';
import {
  ENGINE_SM_ENTER_EVENT,
  ENGINE_SM_EXIT_EVENT,
  ENGINE_SM_FINALIZED_EVENT,
  ENGINE_SM_RESUMED_EVENT,
  ENGINE_SM_SUSPENDED_EVENT,
  ENGINE_SM_TRANSITION_BLOCKED_EVENT,
  ENGINE_SM_UPDATE_EVENT,
} from './engine-state-machine.events';
import { EngineStateMachineDefinitionsRegistry } from './engine-state-machine-definitions.registry';
import { EngineStateMachineTransitionQueue } from './engine-state-machine.transition-queue';
import { EngineStateMachineActiveIndex } from './engine-state-machine-active.index';
import { StateMachineComponent } from './state-machine.component';
import {
  StateId,
  StateMachineBlockedPayload,
  StateMachineEventEntitySnapshot,
  StateMachineIntent,
  StateMachineLifecyclePayload,
  StateMachineRuntimeSnapshot,
  StateMachineTransitionPayload,
  StateMachineUpdatePayload,
  TransitionApplyResult,
  TransitionId,
} from './engine-state-machine.types';
import { EngineStepper } from '../engine-stepper';

@Injectable()
export class EngineStateMachineManager {
  private flushing = false;

  constructor(
    @Inject(EngineEntitiesRegistry)
    private readonly entitiesRegistry: EngineEntitiesRegistry,
    @Inject(EngineEntitiesComponentsManager)
    private readonly componentsManager: EngineEntitiesComponentsManager,
    @Inject(EngineStateMachineDefinitionsRegistry)
    private readonly definitionsRegistry: EngineStateMachineDefinitionsRegistry,
    @Inject(EngineStateMachineTransitionQueue)
    private readonly queue: EngineStateMachineTransitionQueue,
    @Inject(EngineStateMachineActiveIndex)
    private readonly activeIndex: EngineStateMachineActiveIndex,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
    @Inject(EngineStepper)
    private readonly stepper: EngineStepper,
  ) {}

  create<TContext>(
    entityId: string,
    definitionId: string,
    params: { id: string; context?: TContext },
  ): StateMachineComponent<TContext> {
    const entity = this.entitiesRegistry.get(entityId);
    if (!entity) {
      throw new Error(
        `Entity not found for state machine creation: ${entityId}`,
      );
    }

    const definition = this.definitionsRegistry.get<TContext>(definitionId);
    if (!definition) {
      throw new Error(`State machine definition not found: ${definitionId}`);
    }

    const machine = Object.assign(new StateMachineComponent<TContext>(), {
      id: params.id,
      entityId,
      definitionId,
      currentState: definition.initialState,
      previousState: undefined,
      stateEnteredAt: this.stepper.getTick(),
      context: (params.context ?? {}) as TContext,
      suspended: false,
      revision: 0,
    });

    this.componentsManager.add(machine);

    this.eventEmitter.emit(
      ENGINE_SM_ENTER_EVENT,
      this.makeTransitionPayload(
        entity,
        machine,
        undefined,
        machine.currentState,
        undefined,
        this.stepper.getTick(),
      ),
    );

    return machine;
  }

  requestTransition(
    entityId: string,
    machineId: string,
    transitionId: TransitionId,
  ): TransitionApplyResult {
    const intent: StateMachineIntent = {
      kind: 'transition',
      entityId,
      machineId,
      transitionId,
      tick: this.stepper.getTick(),
    };

    this.queue.enqueue(intent);
    this.flush();

    return (
      intent.result ?? {
        code: 'queued',
        entityId,
        machineId,
        transitionId,
      }
    );
  }

  forceState(
    entityId: string,
    machineId: string,
    nextState: StateId,
  ): TransitionApplyResult {
    const intent: StateMachineIntent = {
      kind: 'force',
      entityId,
      machineId,
      nextState,
      tick: this.stepper.getTick(),
    };

    this.queue.enqueue(intent);
    this.flush();

    return (
      intent.result ?? {
        code: 'queued',
        entityId,
        machineId,
        transitionId: `force:${nextState}`,
        to: nextState,
      }
    );
  }

  suspend(entityId: string, machineId: string): boolean {
    const entity = this.entitiesRegistry.get(entityId);
    const machine = this.get(entityId, machineId);
    if (!entity || !machine || machine.suspended) {
      return false;
    }

    machine.suspended = true;

    this.eventEmitter.emit(
      ENGINE_SM_SUSPENDED_EVENT,
      this.makeLifecyclePayload(entity, machine),
    );

    return true;
  }

  resume(entityId: string, machineId: string): boolean {
    const entity = this.entitiesRegistry.get(entityId);
    const machine = this.get(entityId, machineId);
    if (!entity || !machine || !machine.suspended) {
      return false;
    }

    machine.suspended = false;

    this.eventEmitter.emit(
      ENGINE_SM_RESUMED_EVENT,
      this.makeLifecyclePayload(entity, machine),
    );

    return true;
  }

  get<TContext = unknown>(
    entityId: string,
    machineId: string,
  ): StateMachineComponent<TContext> | undefined {
    const component = this.componentsManager.get(entityId, machineId);
    if (!(component instanceof StateMachineComponent)) {
      return undefined;
    }

    return component as StateMachineComponent<TContext>;
  }

  getDefinition<TContext = unknown>(definitionId: string) {
    return this.definitionsRegistry.get<TContext>(definitionId);
  }

  patchContext<TContext>(
    entityId: string,
    machineId: string,
    patch: Partial<TContext>,
  ): boolean {
    const machine = this.get<TContext>(entityId, machineId);
    if (!machine) {
      return false;
    }

    Object.assign(machine.context as object, patch);
    return true;
  }

  tickMachine(
    entityId: string,
    machineId: string,
    tick: number,
    deltaMs: number,
  ): void {
    const entity = this.entitiesRegistry.get(entityId);
    const machine = this.get(entityId, machineId);
    if (!entity || !machine) {
      this.activeIndex.remove(entityId, machineId);
      return;
    }
    if (machine.suspended) {
      return;
    }

    const payload: StateMachineUpdatePayload = {
      entity: this.makeEntitySnapshot(entity),
      machine: this.makeRuntimeSnapshot(machine),
      tick,
      deltaMs,
    };

    this.eventEmitter.emit(ENGINE_SM_UPDATE_EVENT, payload);
  }

  handleRemovedMachine(component: StateMachineComponent): void {
    const entity = this.entitiesRegistry.get(component.entityId);
    const entitySnapshot: StateMachineEventEntitySnapshot = entity
      ? this.makeEntitySnapshot(entity)
      : {
          id: component.entityId,
          tags: [],
        };

    const payload: StateMachineLifecyclePayload = {
      entity: entitySnapshot,
      machine: this.makeRuntimeSnapshot(component),
    };

    this.eventEmitter.emit(ENGINE_SM_FINALIZED_EVENT, payload);
  }

  private flush(): void {
    if (this.flushing) {
      return;
    }

    this.flushing = true;

    try {
      while (this.queue.size > 0) {
        const intent = this.queue.dequeue();
        if (!intent) {
          continue;
        }

        intent.result = this.applyIntent(intent);
      }
    } finally {
      this.flushing = false;
    }
  }

  private applyIntent(intent: StateMachineIntent): TransitionApplyResult {
    if (intent.kind === 'force') {
      return this.applyForceState(
        intent.entityId,
        intent.machineId,
        intent.nextState,
        intent.tick,
      );
    }

    return this.applyTransition(
      intent.entityId,
      intent.machineId,
      intent.transitionId,
      intent.tick,
    );
  }

  private applyTransition(
    entityId: string,
    machineId: string,
    transitionId: TransitionId,
    tick: number,
  ): TransitionApplyResult {
    const entity = this.entitiesRegistry.get(entityId);
    if (!entity) {
      return {
        code: 'missing-entity',
        entityId,
        machineId,
        transitionId,
      };
    }

    const machine = this.get(entityId, machineId);
    if (!machine) {
      return {
        code: 'missing-machine',
        entityId,
        machineId,
        transitionId,
      };
    }

    if (machine.suspended) {
      this.emitBlocked(entity, machine, transitionId, 'suspended', tick);
      return {
        code: 'suspended',
        entityId,
        machineId,
        transitionId,
        from: machine.currentState,
      };
    }

    const definition = this.definitionsRegistry.get(machine.definitionId);
    if (!definition) {
      this.emitBlocked(
        entity,
        machine,
        transitionId,
        'missing-definition',
        tick,
      );
      return {
        code: 'missing-definition',
        entityId,
        machineId,
        transitionId,
        from: machine.currentState,
      };
    }

    const currentState = definition.states[machine.currentState];
    if (!currentState) {
      this.emitBlocked(entity, machine, transitionId, 'missing-state', tick);
      return {
        code: 'missing-state',
        entityId,
        machineId,
        transitionId,
        from: machine.currentState,
      };
    }

    const transition = currentState.transitions?.[transitionId];
    if (!transition) {
      this.emitBlocked(
        entity,
        machine,
        transitionId,
        'missing-transition',
        tick,
      );
      return {
        code: 'missing-transition',
        entityId,
        machineId,
        transitionId,
        from: machine.currentState,
      };
    }

    if (
      transition.guard &&
      !transition.guard({
        entity,
        machine,
        context: machine.context,
      })
    ) {
      this.emitBlocked(entity, machine, transitionId, 'guard-blocked', tick);
      return {
        code: 'guard-blocked',
        entityId,
        machineId,
        transitionId,
        from: machine.currentState,
      };
    }

    return this.commitStateChange(
      entity,
      machine,
      transition.to,
      tick,
      transitionId,
    );
  }

  private applyForceState(
    entityId: string,
    machineId: string,
    nextState: StateId,
    tick: number,
  ): TransitionApplyResult {
    const entity = this.entitiesRegistry.get(entityId);
    if (!entity) {
      return {
        code: 'missing-entity',
        entityId,
        machineId,
        transitionId: `force:${nextState}`,
        to: nextState,
      };
    }

    const machine = this.get(entityId, machineId);
    if (!machine) {
      return {
        code: 'missing-machine',
        entityId,
        machineId,
        transitionId: `force:${nextState}`,
        to: nextState,
      };
    }

    const definition = this.definitionsRegistry.get(machine.definitionId);
    if (!definition) {
      this.emitBlocked(
        entity,
        machine,
        `force:${nextState}`,
        'missing-definition',
        tick,
      );
      return {
        code: 'missing-definition',
        entityId,
        machineId,
        transitionId: `force:${nextState}`,
        from: machine.currentState,
        to: nextState,
      };
    }

    if (!definition.states[nextState]) {
      this.emitBlocked(
        entity,
        machine,
        `force:${nextState}`,
        'missing-state',
        tick,
      );
      return {
        code: 'missing-state',
        entityId,
        machineId,
        transitionId: `force:${nextState}`,
        from: machine.currentState,
        to: nextState,
      };
    }

    return this.commitStateChange(
      entity,
      machine,
      nextState,
      tick,
      `force:${nextState}`,
    );
  }

  private commitStateChange(
    entity: Entity,
    machine: StateMachineComponent,
    nextState: StateId,
    tick: number,
    transitionId: TransitionId,
  ): TransitionApplyResult {
    const previousState = machine.currentState;

    this.eventEmitter.emit(
      ENGINE_SM_EXIT_EVENT,
      this.makeTransitionPayload(
        entity,
        machine,
        previousState,
        nextState,
        transitionId,
        tick,
      ),
    );

    machine.previousState = previousState;
    machine.currentState = nextState;
    machine.stateEnteredAt = tick;
    machine.revision += 1;

    this.eventEmitter.emit(
      ENGINE_SM_ENTER_EVENT,
      this.makeTransitionPayload(
        entity,
        machine,
        previousState,
        nextState,
        transitionId,
        tick,
      ),
    );

    return {
      code: 'applied',
      entityId: entity.id,
      machineId: machine.id,
      transitionId,
      from: previousState,
      to: nextState,
    };
  }

  private emitBlocked(
    entity: Entity,
    machine: StateMachineComponent,
    transitionId: TransitionId,
    reason: StateMachineBlockedPayload['reason'],
    tick: number,
  ): void {
    const payload: StateMachineBlockedPayload = {
      entity: this.makeEntitySnapshot(entity),
      machine: this.makeRuntimeSnapshot(machine),
      transitionId,
      reason,
      tick,
    };

    this.eventEmitter.emit(ENGINE_SM_TRANSITION_BLOCKED_EVENT, payload);
  }

  private makeTransitionPayload(
    entity: Entity,
    machine: StateMachineComponent,
    from: StateId | undefined,
    to: StateId,
    transitionId: TransitionId | undefined,
    tick: number,
  ): StateMachineTransitionPayload {
    return {
      entity: this.makeEntitySnapshot(entity),
      machine: this.makeRuntimeSnapshot(machine),
      from,
      to,
      transitionId,
      tick,
    };
  }

  private makeLifecyclePayload(
    entity: Entity,
    machine: StateMachineComponent,
  ): StateMachineLifecyclePayload {
    return {
      entity: this.makeEntitySnapshot(entity),
      machine: this.makeRuntimeSnapshot(machine),
    };
  }

  private makeEntitySnapshot(entity: Entity): StateMachineEventEntitySnapshot {
    return {
      id: entity.id,
      type: GetEntityType(entity),
      tags: [...entity.tags],
    };
  }

  private makeRuntimeSnapshot<TContext>(
    machine: StateMachineComponent<TContext>,
  ): StateMachineRuntimeSnapshot<TContext> {
    return {
      entityId: machine.entityId,
      machineId: machine.id,
      definitionId: machine.definitionId,
      currentState: machine.currentState,
      previousState: machine.previousState,
      stateEnteredAt: machine.stateEnteredAt,
      suspended: machine.suspended,
      revision: machine.revision,
      context: this.cloneContext(machine.context),
    };
  }

  private cloneContext<TContext>(context: TContext): TContext {
    if (context === undefined || context === null) {
      return context;
    }

    return structuredClone(context);
  }
}
