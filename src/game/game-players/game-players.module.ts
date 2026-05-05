import { Module } from '@nestjs/common';
import { GamePlayersLoader } from './game-players.loader';
import { GamePlayersSystem } from './game-players.system';

@Module({
  providers: [GamePlayersLoader, GamePlayersSystem],
  exports: [GamePlayersLoader],
})
export class GamePlayersModule {}
