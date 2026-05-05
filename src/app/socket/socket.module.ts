import { Module } from '@nestjs/common';
import { SessionsSocketModule } from './sessions/sessions-socket.module';

@Module({
  imports: [SessionsSocketModule],
})
export class SocketModule {}
