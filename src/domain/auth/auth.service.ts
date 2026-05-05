import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../database/entities';
import { JwtService } from '@nestjs/jwt';
import { AuthToken } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Issues a JWT token for the given user.
   *
   * @param user - The user for whom to issue the token.
   * @returns A signed JWT token containing the user's ID and username.
   */
  issueToken(user: User): string {
    return this.jwtService.sign({ id: user.id, username: user.username });
  }

  /**
   * Verifies a JWT token.
   *
   * @param token - The JWT token to verify.
   * @returns The decoded token if valid.
   * @throws Error if the token is invalid or expired.
   */
  verifyToken(token: string): AuthToken {
    return this.jwtService.verify(token);
  }
}
