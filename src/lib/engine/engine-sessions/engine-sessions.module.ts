import { EngineSessionsRegistry } from './engine-sessions.registry';
import { EngineSessionsManager } from './engine-sessions.manager';
import { Global, Module } from '@nestjs/common';
import { EngineSessionSystem } from './engine-session.system';

@Global()
@Module({
  providers: [
    EngineSessionsManager,
    EngineSessionsRegistry,
    EngineSessionSystem,
  ],
  exports: [EngineSessionsManager, EngineSessionsRegistry],
})
export class EngineSessionsModule {}
