import { Inject, Injectable } from '@nestjs/common';
import { EngineDebug } from '../../../lib/engine/engine-debug/engine-debug';

@Injectable()
export class InspectHandler {
  constructor(
    @Inject(EngineDebug)
    private readonly engineDebug: EngineDebug,
  ) {}

  async getDebugInfo() {
    return this.engineDebug.getDebugInfo();
  }
}
