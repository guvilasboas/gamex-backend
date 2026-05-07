import { Global, Module } from '@nestjs/common';
import { EngineInputManager } from './engine-input.manager';
import { EngineInputRegistry } from './engine-input.registry';
import { EngineInputSystem } from './engine-input.system';

@Global()
@Module({
  providers: [EngineInputManager, EngineInputRegistry, EngineInputSystem],
  exports: [EngineInputManager, EngineInputRegistry],
})
export class EngineInputModule {}
