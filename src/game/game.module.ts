import { Module } from '@nestjs/common';
import { PlayersModule } from './players';

@Module({
  imports: [PlayersModule],
})
export class GameModule {}
