import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Match } from '../../../../common/validators';

export class SignupRequestDto {
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(60)
  @ApiProperty()
  name: string;

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

  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(32)
  @Match('password')
  @ApiProperty()
  passwordConfirmation: string;
}

export class SignupResponseDto {
  @ApiProperty()
  accessToken: string;
}
