import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DebugModule } from './debug/debug.module';
import { ConditionalModule } from '@nestjs/config';

@Module({
  imports: [
    AuthModule,
    ConditionalModule.registerWhen(
      DebugModule,
      (env) => env['APP_ENV'] === 'development',
    ),
  ],
})
export class ApiModule {}
