import { Global, Module } from '@nestjs/common';
import { EngineStateMachineDefinitionsRegistry } from './engine-state-machine-definitions.registry';
import { EngineStateMachineActiveIndex } from './engine-state-machine-active.index';
import { EngineStateMachineTransitionQueue } from './engine-state-machine.transition-queue';
import { EngineStateMachineManager } from './engine-state-machine.manager';
import { EngineStateMachineSystem } from './engine-state-machine.system';

@Global()
@Module({
  providers: [
    EngineStateMachineDefinitionsRegistry,
    EngineStateMachineActiveIndex,
    EngineStateMachineTransitionQueue,
    EngineStateMachineManager,
    EngineStateMachineSystem,
  ],
  exports: [
    EngineStateMachineDefinitionsRegistry,
    EngineStateMachineActiveIndex,
    EngineStateMachineTransitionQueue,
    EngineStateMachineManager,
  ],
})
export class EngineStateMachineModule {}
