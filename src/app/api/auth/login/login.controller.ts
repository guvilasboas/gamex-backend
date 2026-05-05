import { Body, Controller, Inject, Post } from '@nestjs/common';
import { LoginHandler } from './login.handler';
import { LoginRequestDto, LoginResponseDto } from './login.dto';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

@Controller('auth/login')
export class LoginController {
  constructor(
    @Inject(LoginHandler)
    private readonly loginHandler: LoginHandler,
  ) {}

  @Post()
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiOperation({ operationId: 'login' })
  async login(@Body() data: LoginRequestDto): Promise<LoginResponseDto> {
    return await this.loginHandler.login(data);
  }
}
