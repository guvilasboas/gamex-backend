import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  static SALT_ROUNDS = 10;

  /**
   * Hashes a password using bcrypt with a specified number of salt rounds.
   *
   * @param password
   * @returns
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PasswordService.SALT_ROUNDS);
  }

  /**
   * Compares a plaintext password with a hashed password to check for a match.
   *
   * @param password
   * @param hash
   * @returns
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
