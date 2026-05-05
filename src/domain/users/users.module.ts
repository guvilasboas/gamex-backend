import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../../database/entities';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordModule } from '../../common/password';

@Module({
  imports: [PasswordModule, TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
