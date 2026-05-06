import { EngineEntitiesComponentsModule } from './engine-entities-components';
import { EngineEntitiesManager } from './engine-entities.manager';
import { EngineEntitiesRegistry } from './engine-entities.registry';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [EngineEntitiesComponentsModule],
  providers: [EngineEntitiesRegistry, EngineEntitiesManager],
  exports: [EngineEntitiesRegistry, EngineEntitiesManager],
})
export class EngineEntitiesModule {}
