import { plainToInstance } from 'class-transformer';
import { Player } from './player.entity';
import { CreateEntity } from '../../lib/engine/engine-entities';

export class PlayerFactory {
  constructor(private readonly sessionId: string) {}

  build(): Player {
    const player = plainToInstance(Player, {
      id: this.sessionId,
      sessionId: this.sessionId,
      tags: ['player', 'idle', 'collidable'],
    });

    CreateEntity(player);

    return player;
  }

  static create(sessionId: string): Player {
    const factory = new PlayerFactory(sessionId);

    return factory.build();
  }
}
