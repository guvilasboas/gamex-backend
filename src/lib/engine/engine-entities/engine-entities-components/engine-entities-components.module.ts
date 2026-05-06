import { Global, Module } from '@nestjs/common';
import { EngineEntitiesComponentsRegistry } from './engine-entities-components.registry';

@Global()
@Module({
  providers: [EngineEntitiesComponentsRegistry],
  exports: [EngineEntitiesComponentsRegistry],
})
export class EngineEntitiesComponentsModule {}
