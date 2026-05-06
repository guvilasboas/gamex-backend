import { plainToInstance } from 'class-transformer';
import { Player } from './player.entity';
import { AddCollider } from '../../lib/engine/engine-collisions';
import { Vector3 } from 'three';
import { CreateEntity } from '../../lib/engine/engine-entities';
import {
  AddComponent,
  AttachComponent,
} from '../../lib/engine/engine-entities/engine-entities-components';
import { AnimationComponent } from '../../lib/engine/engine-render';

export class PlayerFactory {
  constructor(private readonly sessionId: string) {}

  private addColliders(player: Player) {
    AddCollider({
      id: player.id,
      entityId: player.id,
      size: new Vector3(64, 24, 0),
      tags: ['player'],
    });

    return this;
  }

  private addAnimations(player: Player) {
    AttachComponent<AnimationComponent>(player.id, AnimationComponent, {
      id: player.id,
    });

    return this;
  }

  build(): Player {
    const player = plainToInstance(Player, {
      id: this.sessionId,
      sessionId: this.sessionId,
      tags: ['player', 'idle', 'collidable'],
    });

    CreateEntity(player);

    this.addColliders(player).addAnimations(player);

    return player;
  }

  static create(sessionId: string): Player {
    const factory = new PlayerFactory(sessionId);

    return factory.build();
  }
}
