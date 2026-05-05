import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionResponseDto } from './session.dto';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../../../../domain/auth/auth.guard';
import { Auth } from '../../../../domain/auth/auth.decorator';
import { type AuthToken } from '../../../../domain/auth/auth.types';
import { plainToInstance } from 'class-transformer';

@Controller('auth/session')
@UseGuards(AuthGuard)
export class SessionController {
  @Get()
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiOperation({ operationId: 'getSession' })
  getSession(@Auth() session: AuthToken): SessionResponseDto {
    return plainToInstance(SessionResponseDto, {
      id: session.id,
      username: session.username,
    });
  }
}
