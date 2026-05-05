import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { User } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): DataSourceOptions => {
        const type = config.get<string>('DB_TYPE', 'better-sqlite3');

        const synchronize =
          config.get<string>('DB_SYNCHRONIZE', 'true') === 'true';

        const entities = [User];

        if (type === 'postgres') {
          const url = config.get<string>('DB_URL');
          if (url) {
            return { type: 'postgres', url, entities, synchronize };
          }
          return {
            type: 'postgres',
            host: config.get<string>('DB_HOST', 'localhost'),
            port: config.get<number>('DB_PORT', 5432),
            username: config.get<string>('DB_USERNAME'),
            password: config.get<string>('DB_PASSWORD'),
            database: config.get<string>('DB_DATABASE'),
            entities,
            synchronize,
          };
        }

        return {
          type: 'better-sqlite3',
          database: config.get<string>('DB_DATABASE', 'database.sqlite'),
          entities,
          synchronize,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
