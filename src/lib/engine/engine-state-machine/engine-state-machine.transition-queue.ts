import { Injectable } from '@nestjs/common';
import { StateMachineIntent } from './engine-state-machine.types';

@Injectable()
export class EngineStateMachineTransitionQueue {
  private readonly items: StateMachineIntent[] = [];

  enqueue(intent: StateMachineIntent): void {
    this.items.push(intent);
  }

  dequeue(): StateMachineIntent | undefined {
    return this.items.shift();
  }

  get size(): number {
    return this.items.length;
  }
}
