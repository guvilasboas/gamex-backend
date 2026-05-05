import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { LoginRequestDto, LoginResponseDto } from './login.dto';
import { plainToInstance } from 'class-transformer';
import { UsersService } from '../../../../domain/users/users.service';
import { PasswordService } from '../../../../common/password';
import { AuthService } from '../../../../domain/auth/auth.service';

@Injectable()
export class LoginHandler {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  /**
   * Handles the login process for a user.
   *
   * @param data
   * @returns
   */
  async login(data: LoginRequestDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByUsername(data.username);
    if (!user) {
      throw new BadRequestException('Invalid username or password.');
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      data.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid username or password.');
    }

    const accessToken = this.authService.issueToken(user);

    return plainToInstance(LoginResponseDto, { accessToken });
  }
}
