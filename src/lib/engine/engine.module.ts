import { EngineSessionsModule } from './engine-sessions/engine-sessions.module';
import { EngineDebugModule } from './engine-debug/engine-debug.module';
import { EngineCollisionsModule } from './engine-collisions';
import { EngineStateMachineModule } from './engine-state-machine';
import { EngineEntitiesModule } from './engine-entities';
import { EngineChunksModule } from './engine-chunks';
import { EngineStoreModule } from './engine-store';
import { EngineStepper } from './engine-stepper';
import { Module } from '@nestjs/common';
import { Engine } from './engine';

@Module({
  imports: [
    EngineCollisionsModule,
    EngineEntitiesModule,
    EngineStateMachineModule,
    EngineSessionsModule,
    EngineChunksModule,
    EngineDebugModule,
    EngineStoreModule,
  ],
  providers: [Engine, EngineStepper],
  exports: [Engine, EngineStepper],
})
export class EngineModule {}
