import { Module } from '@nestjs/common';
import { EngineCollisionsManager } from './engine-collisions.manager';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollisionsSystem } from './engine-collisions.system';
import { EngineCollidersRegistry } from './engine-colliders.registry';
import { EngineCollidersSystem } from './engine-colliders.system';
import { AabbDetector } from './detectors/aabb.detector';

@Module({
  providers: [
    EngineCollisionsRegistry,
    EngineCollidersRegistry,
    EngineCollisionsManager,
    EngineCollisionsSystem,
    EngineCollidersSystem,
    AabbDetector,
  ],
  exports: [
    EngineCollisionsRegistry,
    EngineCollidersRegistry,
    EngineCollisionsManager,
  ],
})
export class EngineCollisionsModule {}
