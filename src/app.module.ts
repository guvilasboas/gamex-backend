import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { SocketModule } from './app/socket/socket.module';
import { ApiModule } from './app/api/api.module';
import { ConfigModule } from '@nestjs/config';
import { EngineModule } from './lib/engine';
import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { GameModule } from './game';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    CqrsModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    DatabaseModule,
    EngineModule,
    GameModule,
    ApiModule,
    SocketModule,
  ],
})
export class AppModule {}
