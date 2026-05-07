import { Injectable, OnModuleInit } from '@nestjs/common';
import { RegisterStateMachine } from '../../lib/engine/engine-state-machine';
import { PlayerMovementMachineDefinition } from './player-movement.machine';

@Injectable()
export class GamePlayersStateMachineSystem implements OnModuleInit {
  onModuleInit(): void {
    RegisterStateMachine(PlayerMovementMachineDefinition);
  }
}
