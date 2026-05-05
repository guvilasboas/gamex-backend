import { Global, Module } from '@nestjs/common';
import { EngineDebug } from './engine-debug';

@Global()
@Module({
  providers: [EngineDebug],
  exports: [EngineDebug],
})
export class EngineDebugModule {}
