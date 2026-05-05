import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { AuthModule } from '../../../../domain/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SessionController],
})
export class SessionModule {}
