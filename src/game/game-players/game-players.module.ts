import { Module } from '@nestjs/common';
import { GamePlayersLoader } from './game-players.loader';
import { GamePlayersSystem } from './game-players.system';
import { GamePlayersMovementSystem } from './game-players.movement.system';
import { GamePlayersInputCompatSystem } from './game-players.input-compat.system';

@Module({
  providers: [
    GamePlayersLoader,
    GamePlayersSystem,
    GamePlayersMovementSystem,
    GamePlayersInputCompatSystem,
  ],
  exports: [GamePlayersLoader],
})
export class GamePlayersModule {}
