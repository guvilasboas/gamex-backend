import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Entity } from '../engine-entities';
import { EngineEntitiesRegistry } from '../engine-entities/engine-entities.registry';
import {
  EngineEntitiesComponentsManager,
  EngineEntitiesComponentsRegistry,
} from '../engine-entities/engine-entities-components';
import {
  ENGINE_SM_ENTER_EVENT,
  ENGINE_SM_FINALIZED_EVENT,
  ENGINE_SM_TRANSITION_BLOCKED_EVENT,
} from './engine-state-machine.events';
import { EngineStateMachineDefinitionsRegistry } from './engine-state-machine-definitions.registry';
import { EngineStateMachineActiveIndex } from './engine-state-machine-active.index';
import { EngineStateMachineTransitionQueue } from './engine-state-machine.transition-queue';
import { EngineStateMachineManager } from './engine-state-machine.manager';
import { EngineStateMachineSystem } from './engine-state-machine.system';
import { StateMachineDefinition } from './engine-state-machine.types';

describe('EngineStateMachineManager', () => {
  let testingModule: TestingModule;
  let entitiesRegistry: EngineEntitiesRegistry;
  let componentsManager: EngineEntitiesComponentsManager;
  let definitionsRegistry: EngineStateMachineDefinitionsRegistry;
  let activeIndex: EngineStateMachineActiveIndex;
  let manager: EngineStateMachineManager;
  let eventEmitter: EventEmitter2;

  const definition: StateMachineDefinition<{ canRespawn: boolean }> = {
    id: 'player.movement',
    initialState: 'idle',
    states: {
      idle: {
        id: 'idle',
        transitions: {
          die: { to: 'dead' },
        },
      },
      dead: {
        id: 'dead',
        transitions: {
          respawn: {
            to: 'idle',
            guard: ({ context }) => context.canRespawn,
          },
        },
      },
    },
  };

  function createEntity(entityId: string): Entity {
    const entity = Object.assign(new Entity(), {
      id: entityId,
      tags: ['player'],
    });
    entitiesRegistry.add(entity);
    return entity;
  }

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        EngineEntitiesRegistry,
        EngineEntitiesComponentsRegistry,
        EngineEntitiesComponentsManager,
        EngineStateMachineDefinitionsRegistry,
        EngineStateMachineActiveIndex,
        EngineStateMachineTransitionQueue,
        EngineStateMachineManager,
        EngineStateMachineSystem,
      ],
    }).compile();

    await testingModule.init();

    entitiesRegistry = testingModule.get(EngineEntitiesRegistry);
    componentsManager = testingModule.get(EngineEntitiesComponentsManager);
    definitionsRegistry = testingModule.get(
      EngineStateMachineDefinitionsRegistry,
    );
    activeIndex = testingModule.get(EngineStateMachineActiveIndex);
    manager = testingModule.get(EngineStateMachineManager);
    eventEmitter = testingModule.get(EventEmitter2);
    testingModule.get(EngineStateMachineSystem);

    definitionsRegistry.register(definition);
  });

  afterEach(async () => {
    await testingModule.close();
  });

  it('emits the initial enter event on machine creation', () => {
    createEntity('entity-1');

    const enterEvents: string[] = [];
    eventEmitter.on(ENGINE_SM_ENTER_EVENT, (payload) => {
      enterEvents.push(payload.to);
    });

    const machine = manager.create(
      'entity-1',
      'player.movement',
      {
        id: 'movement',
        context: { canRespawn: true },
      },
      0,
    );

    expect(machine.currentState).toBe('idle');
    expect(enterEvents).toEqual(['idle']);
  });

  it('returns blocked details for a missing transition and emits a blocked event', () => {
    createEntity('entity-1');
    manager.create(
      'entity-1',
      'player.movement',
      {
        id: 'movement',
        context: { canRespawn: false },
      },
      0,
    );

    const blockedReasons: string[] = [];
    eventEmitter.on(ENGINE_SM_TRANSITION_BLOCKED_EVENT, (payload) => {
      blockedReasons.push(payload.reason);
    });

    const result = manager.requestTransition('entity-1', 'movement', 'jump', 1);

    expect(result.code).toBe('missing-transition');
    expect(blockedReasons).toEqual(['missing-transition']);
  });

  it('queues nested transitions instead of mutating reentrantly', () => {
    createEntity('entity-1');
    manager.create(
      'entity-1',
      'player.movement',
      {
        id: 'movement',
        context: { canRespawn: true },
      },
      0,
    );

    const enterOrder: string[] = [];
    eventEmitter.on(ENGINE_SM_ENTER_EVENT, (payload) => {
      if (payload.to === 'idle' && payload.from === undefined) {
        return;
      }

      enterOrder.push(payload.to);

      if (payload.to === 'dead') {
        const nestedResult = manager.requestTransition(
          'entity-1',
          'movement',
          'respawn',
          1,
        );
        expect(nestedResult.code).toBe('queued');
      }
    });

    const result = manager.requestTransition('entity-1', 'movement', 'die', 1);
    const machine = manager.get('entity-1', 'movement');

    expect(result.code).toBe('applied');
    expect(machine?.currentState).toBe('idle');
    expect(machine?.previousState).toBe('dead');
    expect(machine?.revision).toBe(2);
    expect(enterOrder).toEqual(['dead', 'idle']);
  });

  it('keeps the active index in sync and emits finalized when a machine is removed', () => {
    createEntity('entity-1');

    const finalizedMachineIds: string[] = [];
    eventEmitter.on(ENGINE_SM_FINALIZED_EVENT, (payload) => {
      finalizedMachineIds.push(payload.machine.machineId);
    });

    manager.create(
      'entity-1',
      'player.movement',
      {
        id: 'movement',
        context: { canRespawn: true },
      },
      0,
    );

    expect(activeIndex.getAll()).toEqual([
      { entityId: 'entity-1', machineId: 'movement' },
    ]);

    componentsManager.remove('entity-1', 'movement');

    expect(activeIndex.getAll()).toEqual([]);
    expect(finalizedMachineIds).toEqual(['movement']);
  });
});
