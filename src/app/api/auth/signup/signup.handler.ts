import { Inject, Injectable } from '@nestjs/common';
import { SignupRequestDto, SignupResponseDto } from './signup.dto';
import { plainToInstance } from 'class-transformer';
import { UsersService } from '../../../../domain/users/users.service';
import { AuthService } from '../../../../domain/auth/auth.service';

@Injectable()
export class SignupHandler {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  /**
   * Handles the signup process for a new user.
   *
   * @param data
   * @returns
   */
  async signup(data: SignupRequestDto): Promise<SignupResponseDto> {
    const createdUser = await this.usersService.createUser({
      name: data.name,
      username: data.username,
      password: data.password,
    });

    const accessToken = this.authService.issueToken(createdUser);

    return plainToInstance(SignupResponseDto, { accessToken });
  }
}
