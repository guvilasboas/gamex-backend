import { INestApplication } from '@nestjs/common';

export class Container {
  static app: INestApplication;

  static set(appInstance: INestApplication) {
    this.app = appInstance;
  }

  static get<T>(token: Parameters<INestApplication['get']>[0]): T {
    return this.app.get(token);
  }
}
