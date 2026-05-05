import { EngineEntitiesManager } from './engine-entities.manager';
import { EngineEntitiesRegistry } from './engine-entities.registry';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [EngineEntitiesRegistry, EngineEntitiesManager],
  exports: [EngineEntitiesRegistry, EngineEntitiesManager],
})
export class EngineEntitiesModule {}
