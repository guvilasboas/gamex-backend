import { Module } from '@nestjs/common';
import { GameSessionsSystem } from './game-sessions.system';
import { GamePlayersModule } from '../game-players/game-players.module';

@Module({
  imports: [GamePlayersModule],
  providers: [GameSessionsSystem],
})
export class GameSessionsModule {}
