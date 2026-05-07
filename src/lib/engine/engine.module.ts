import { EngineSessionsModule } from './engine-sessions/engine-sessions.module';
import { EngineDebugModule } from './engine-debug/engine-debug.module';
import { EngineCollisionsModule } from './engine-collisions';
import { EngineStateMachineModule } from './engine-state-machine';
import { EngineEntitiesModule } from './engine-entities';
import { EngineChunksModule } from './engine-chunks';
import { EngineStoreModule } from './engine-store';
import { EngineInputModule } from './engine-input';
import { EngineStepper } from './engine-stepper';
import { Global, Module } from '@nestjs/common';
import { Engine } from './engine';

@Global()
@Module({
  imports: [
    EngineCollisionsModule,
    EngineEntitiesModule,
    EngineStateMachineModule,
    EngineSessionsModule,
    EngineInputModule,
    EngineChunksModule,
    EngineDebugModule,
    EngineStoreModule,
  ],
  providers: [Engine, EngineStepper],
  exports: [Engine, EngineStepper],
})
export class EngineModule {}
