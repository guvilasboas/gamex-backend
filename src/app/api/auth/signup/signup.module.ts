import { Module } from '@nestjs/common';
import { SignupHandler } from './signup.handler';
import { SignupController } from './signup.controller';
import { UsersModule } from '../../../../domain/users/users.module';
import { AuthModule } from '../../../../domain/auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  providers: [SignupHandler],
  controllers: [SignupController],
})
export class SignupModule {}
