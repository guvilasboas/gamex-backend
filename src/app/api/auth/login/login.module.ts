import { Module } from '@nestjs/common';
import { LoginHandler } from './login.handler';
import { LoginController } from './login.controller';
import { UsersModule } from '../../../../domain/users/users.module';
import { PasswordModule } from '../../../../common/password';
import { AuthModule } from '../../../../domain/auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule, PasswordModule],
  providers: [LoginHandler],
  controllers: [LoginController],
})
export class LoginModule {}
