import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  /**
   * Determines whether the current request is allowed to proceed.
   *
   * @param context - The execution context of the request.
   * @returns A boolean indicating whether the request is allowed.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      return false;
    }

    const authToken = this.authService.verifyToken(token);
    if (!authToken) {
      return false;
    }

    request['session'] = authToken;

    return true;
  }

  /**
   * Extracts the JWT token from the Authorization header of the request.
   *
   * @param request - The incoming HTTP request.
   * @returns The JWT token if present, otherwise undefined.
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
