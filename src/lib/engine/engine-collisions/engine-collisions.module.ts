import { Global, Module } from '@nestjs/common';
import { EngineCollisionsManager } from './engine-collisions.manager';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollisionsSystem } from './engine-collisions.system';
import { AabbDetector } from './detectors/aabb.detector';

@Global()
@Module({
  providers: [
    EngineCollisionsRegistry,
    EngineCollisionsManager,
    EngineCollisionsSystem,
    AabbDetector,
  ],
  exports: [EngineCollisionsRegistry, EngineCollisionsManager],
})
export class EngineCollisionsModule {}
