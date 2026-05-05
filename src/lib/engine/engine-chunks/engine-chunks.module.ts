import { Global, Module } from '@nestjs/common';
import { EngineChunksRegistry } from './engine-chunks.registry';
import { EngineChunksManager } from './engine-chunks.manager';
import { EngineChunksSystem } from './engine-chunks.system';

@Global()
@Module({
  providers: [EngineChunksRegistry, EngineChunksManager, EngineChunksSystem],
  exports: [EngineChunksRegistry, EngineChunksManager, EngineChunksSystem],
})
export class EngineChunksModule {}
