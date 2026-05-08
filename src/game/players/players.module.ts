import { PlayerFactoryService, PlayerLoaderService } from './services';
import { PlayersMovementSystem } from './systems/players-movement.system';
import { PlayersSessionSystem, PlayersStateMachineSystem } from './systems';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    PlayerLoaderService,
    PlayerFactoryService,
    PlayersSessionSystem,
    PlayersStateMachineSystem,
    PlayersMovementSystem,
  ],
})
export class PlayersModule {}
