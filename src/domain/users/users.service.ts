import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../database/entities';
import { Repository } from 'typeorm/repository/Repository.js';
import { Inject } from '@nestjs/common';
import { PasswordService } from '../../common/password';
import { Equal } from 'typeorm';

export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Finds a user by their username.
   *
   * @param username - The username of the user to find.
   * @returns The user with the given username, or null if not found.
   */
  async findByUsername(username: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { username: Equal(username) },
    });
  }

  /**
   * Creates a new user.
   *
   * @param data - The data for the new user.
   * @returns The created user.
   * @throws Error if the username or password is missing, or if the username already exists.
   */
  async createUser(data: Partial<User>): Promise<User> {
    if (!data.username || !data.password) {
      throw new Error('Username and password are required to create a user.');
    }

    const { password, username } = data;

    const existingUser = await this.findByUsername(username);
    if (existingUser) {
      throw new Error('User with this username already exists.');
    }

    const hashedPassword = await this.passwordService.hashPassword(
      password ?? '',
    );

    const user = this.usersRepository.create({
      ...data,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }
}
