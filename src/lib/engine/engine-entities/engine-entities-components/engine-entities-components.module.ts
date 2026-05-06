import { Global, Module } from '@nestjs/common';
import { EngineEntitiesComponentsRegistry } from './engine-entities-components.registry';
import { EngineEntitiesComponentsManager } from './engine-entities-components.manager';
import { EngineEntitiesComponentsSystem } from './engine-entities-components.system';

@Global()
@Module({
  providers: [
    EngineEntitiesComponentsRegistry,
    EngineEntitiesComponentsManager,
    EngineEntitiesComponentsSystem,
  ],
  exports: [EngineEntitiesComponentsRegistry, EngineEntitiesComponentsManager],
})
export class EngineEntitiesComponentsModule {}
