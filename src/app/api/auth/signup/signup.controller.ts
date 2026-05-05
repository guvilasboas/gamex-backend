import { Body, Controller, Inject, Post } from '@nestjs/common';
import { SignupHandler } from './signup.handler';
import { SignupRequestDto, SignupResponseDto } from './signup.dto';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

@Controller('auth/signup')
export class SignupController {
  constructor(
    @Inject(SignupHandler)
    private readonly signupHandler: SignupHandler,
  ) {}

  @Post()
  @ApiOkResponse({ type: SignupResponseDto })
  @ApiOperation({ operationId: 'signup' })
  async signup(@Body() data: SignupRequestDto): Promise<SignupResponseDto> {
    return this.signupHandler.signup(data);
  }
}
