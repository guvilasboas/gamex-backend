import { RegisterStateMachine } from '../../lib/engine/engine-state-machine';
import { PlayerMovementMachineDefinition } from './machines';
import { PlayerFactoryService, PlayerLoaderService } from './services';
import {
  PlayersAnimationSystem,
  PlayersMovementSystem,
  PlayersSessionSystem,
} from './systems';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    PlayersAnimationSystem,
    PlayersMovementSystem,
    PlayersSessionSystem,
    PlayerFactoryService,
    PlayerLoaderService,
  ],
})
export class PlayersModule {
  onModuleInit() {
    RegisterStateMachine(PlayerMovementMachineDefinition);
  }
}
