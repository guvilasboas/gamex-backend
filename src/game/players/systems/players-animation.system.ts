import { EngineEntitiesComponentsManager } from '../../../lib/engine/engine-entities/engine-entities-components';
import { EngineEntitiesManager } from '../../../lib/engine/engine-entities';
import { Inject, Injectable } from '@nestjs/common';
import {
  PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
  type PlayerMovementState,
} from '../machines';
import animations from '../animations';
import { StateMachineComponent } from '../../../lib/engine/engine-state-machine';
import { Player } from '../entities';
import { AnimationComponent } from '../../../lib/engine/engine-render';
import { OnAfterUpdate } from '../../../lib/engine';

@Injectable()
export class PlayersAnimationSystem {
  constructor(
    @Inject(EngineEntitiesComponentsManager)
    private readonly engineEntitiesComponentsManager: EngineEntitiesComponentsManager,
    @Inject(EngineEntitiesManager)
    private readonly engineEntitiesManager: EngineEntitiesManager,
  ) {}

  @OnAfterUpdate()
  onAfterUpdate() {
    const players = this.engineEntitiesManager.getOfType(Player);

    players.forEach(this.handlePlayerAnimation.bind(this));
  }

  private handlePlayerAnimation(player: Player) {
    const currentAnimation =
      this.engineEntitiesComponentsManager.get<AnimationComponent>(
        player.id,
        'animation',
      );

    const newAnimation = animations[player.movementState][player.facing];

    if (currentAnimation?.animation === newAnimation.animation) {
      return;
    }

    this.engineEntitiesComponentsManager.patch<AnimationComponent>(
      player.id,
      'animation',
      {
        resource: newAnimation.resource,
        animation: newAnimation.animation,
        frameRate: newAnimation.frameRate,
      },
    );

    this.engineEntitiesManager.update(player);
  }
}
