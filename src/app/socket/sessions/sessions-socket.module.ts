import { Module } from '@nestjs/common';
import { AuthModule } from '../../../domain/auth';
import { SessionsSocketGateway } from './sessions-socket.gateway';
import { SessionsSocketHandler } from './sessions-socket.handler';

@Module({
  imports: [AuthModule],
  providers: [SessionsSocketGateway, SessionsSocketHandler],
})
export class SessionsSocketModule {}
