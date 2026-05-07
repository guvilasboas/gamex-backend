import { Injectable, Inject } from '@nestjs/common';
import { OnAction } from '../../lib/engine/engine-sessions';
import { EngineInputManager } from '../../lib/engine/engine-input';
import { type MoveAction } from './game-players.actions';

@Injectable()
export class GamePlayersInputCompatSystem {
  constructor(
    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  @OnAction('move')
  onLegacyMove({ sessionId, action }: MoveAction): void {
    this.input.setSnapshot(sessionId, {
      'move.up': action.up,
      'move.down': action.down,
      'move.left': action.left,
      'move.right': action.right,
    });
  }
}
