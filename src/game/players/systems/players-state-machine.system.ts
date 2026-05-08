import { Injectable, OnModuleInit } from '@nestjs/common';
import { RegisterStateMachine } from '../../../lib/engine/engine-state-machine';
import { PlayerMovementMachineDefinition } from '../machines';

@Injectable()
export class PlayersStateMachineSystem implements OnModuleInit {
  onModuleInit(): void {
    RegisterStateMachine(PlayerMovementMachineDefinition);
  }
}
