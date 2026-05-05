import { Module } from '@nestjs/common';
import { GameSessionsModule } from './game-sessions';

@Module({
  imports: [GameSessionsModule],
})
export class GameModule {}
