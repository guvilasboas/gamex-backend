import { EngineSessionsModule } from './engine-sessions/engine-sessions.module';
import { EngineDebugModule } from './engine-debug/engine-debug.module';
import { EngineEntitiesModule } from './engine-entities';
import { EngineChunksModule } from './engine-chunks';
import { EngineStoreModule } from './engine-store';
import { EngineCollisionsModule } from './engine-collisions';
import { EngineStepper } from './engine-stepper';
import { Module } from '@nestjs/common';
import { Engine } from './engine';

@Module({
  imports: [
    EngineEntitiesModule,
    EngineSessionsModule,
    EngineChunksModule,
    EngineDebugModule,
    EngineStoreModule,
    EngineCollisionsModule,
  ],
  providers: [Engine, EngineStepper],
  exports: [Engine, EngineStepper],
})
export class EngineModule {}
