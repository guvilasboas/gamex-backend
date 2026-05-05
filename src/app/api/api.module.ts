import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { InspectModule } from './inspect/inspect.module';

@Module({
  imports: [AuthModule, InspectModule],
})
export class ApiModule {}
