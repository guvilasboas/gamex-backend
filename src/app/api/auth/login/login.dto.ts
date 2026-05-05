import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(32)
  @ApiProperty()
  username: string;

  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(32)
  @ApiProperty()
  password: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;
}
