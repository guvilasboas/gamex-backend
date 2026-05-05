import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ENGINE_STORE_UPDATED_EVENT } from './engine-store.events';

export type EngineStorePatch<T = unknown> = {
  type: 'set' | 'delete';
  key: string;
  value?: T;
};

@Injectable()
export class EngineStoreManager {
  constructor(
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  patch<T>(patch: EngineStorePatch<T>) {
    this.eventEmitter.emit(ENGINE_STORE_UPDATED_EVENT, patch);
  }
}
