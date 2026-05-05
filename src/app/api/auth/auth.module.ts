import { Module } from '@nestjs/common';
import { SignupModule } from './signup/signup.module';
import { LoginModule } from './login/login.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [SignupModule, LoginModule, SessionModule],
})
export class AuthModule {}
