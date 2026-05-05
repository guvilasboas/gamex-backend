import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DebugModule } from './debug/debug.module';

@Module({
  imports: [AuthModule, DebugModule],
})
export class ApiModule {}
