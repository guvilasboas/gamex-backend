import { Module } from '@nestjs/common';
import { GamePlayersLoader } from './game-players.loader';
import { GamePlayersSystem } from './game-players.system';
import { GamePlayersMovementSystem } from './game-players.movement.system';
import { GamePlayersInputCompatSystem } from './game-players.input-compat.system';
import { GamePlayersStateMachineSystem } from './game-players.state-machine.system';

@Module({
  providers: [
    GamePlayersLoader,
    GamePlayersSystem,
    GamePlayersMovementSystem,
    GamePlayersInputCompatSystem,
    GamePlayersStateMachineSystem,
  ],
  exports: [GamePlayersLoader],
})
export class GamePlayersModule {}
