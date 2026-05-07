import { Injectable } from '@nestjs/common';

export type ActiveStateMachineRef = {
  entityId: string;
  machineId: string;
};

@Injectable()
export class EngineStateMachineActiveIndex {
  private readonly machineKeys = new Set<string>();

  private makeKey(entityId: string, machineId: string): string {
    return `${entityId}::${machineId}`;
  }

  add(entityId: string, machineId: string): void {
    this.machineKeys.add(this.makeKey(entityId, machineId));
  }

  remove(entityId: string, machineId: string): void {
    this.machineKeys.delete(this.makeKey(entityId, machineId));
  }

  getAll(): ActiveStateMachineRef[] {
    return Array.from(this.machineKeys, (key) => {
      const [entityId, machineId] = key.split('::');
      return { entityId, machineId };
    });
  }
}
