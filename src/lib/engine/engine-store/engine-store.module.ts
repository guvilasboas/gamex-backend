import { EngineStoreManager } from './engine-store.manager';
import { EngineStoreSystem } from './engine-store.system';
import { EngineStoreState } from './engine-store.state';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [EngineStoreManager, EngineStoreSystem, EngineStoreState],
  exports: [EngineStoreManager, EngineStoreSystem, EngineStoreState],
})
export class EngineStoreModule {}
