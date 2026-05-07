import { Inject, Injectable } from '@nestjs/common';
import { OnUpdate } from '../../lib/engine/engine-decorators';
import { EngineInputManager } from '../../lib/engine/engine-input';
import { WouldCollideAt } from '../../lib/engine/engine-collisions';
import { UpdateEntity } from '../../lib/engine/engine-entities';
import {
  AddComponent,
  ComponentFactory,
  GetComponent,
} from '../../lib/engine/engine-entities/engine-entities-components';
import { Transition } from '../../lib/engine/engine-state-machine';
import { StateMachineComponent } from '../../lib/engine/engine-state-machine';
import { AnimationComponent } from '../../lib/engine/engine-render';
import { Vector3 } from 'three';
import { Player } from './player.entity';
import { EngineEntitiesManager } from '../../lib/engine/engine-entities/engine-entities.manager';
import {
  PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
  PlayerMovementState,
} from './player-movement.machine';
import {
  PLAYER_ANIMATION_COMPONENT_ID,
  PLAYER_ANIMATION_FRAME_RATE,
  PLAYER_ANIMATION_RESOURCE,
  PlayerFacing,
  resolvePlayerAnimation,
} from './game-players.animation';

const INPUT_STALE_TICKS = 10;

@Injectable()
export class GamePlayersMovementSystem {
  constructor(
    @Inject(EngineEntitiesManager)
    private readonly entities: EngineEntitiesManager,

    @Inject(EngineInputManager)
    private readonly input: EngineInputManager,
  ) {}

  @OnUpdate()
  onUpdate(): void {
    for (const player of this.entities.getOfType(Player)) {
      if (!player.sessionId) continue;

      const isStale = this.input.isStale(player.sessionId, INPUT_STALE_TICKS);
      const direction = isStale
        ? new Vector3(0, 0, 0)
        : this.getMovementDirection(player.sessionId);
      const isMoving = direction.lengthSq() > 0;

      Transition(
        player.id,
        PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
        isMoving ? 'start_walking' : 'stop_walking',
      );

      this.syncTagsFromMachine(player);

      if (isMoving) {
        this.syncFacing(player, direction);

        const delta = direction.multiplyScalar(player.speed);
        const futurePosition = player.position.clone().add(delta);

        if (!WouldCollideAt(player.id, futurePosition)) {
          player.move(delta);
        }
      }

      this.syncAnimation(player);

      UpdateEntity(player);
    }
  }

  private syncTagsFromMachine(player: Player): void {
    const machine = GetComponent(
      player.id,
      PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
    ) as StateMachineComponent<unknown> | undefined;

    if (!machine) return;

    const state = machine.currentState as PlayerMovementState;

    if (state === 'walking') {
      player.addTag('walking');
      player.removeTag('idle');
    } else {
      player.addTag('idle');
      player.removeTag('walking');
    }
  }

  private syncFacing(player: Player, direction: Vector3): void {
    if (direction.x < 0) {
      player.facing = 'left';
    } else if (direction.x > 0) {
      player.facing = 'right';
    } else if (direction.y < 0) {
      player.facing = 'up';
    } else if (direction.y > 0) {
      player.facing = 'down';
    }
  }

  private syncAnimation(player: Player): void {
    const machine = GetComponent(
      player.id,
      PLAYER_MOVEMENT_MACHINE_COMPONENT_ID,
    ) as StateMachineComponent<unknown> | undefined;

    if (!machine) return;

    const newAnimation = resolvePlayerAnimation(
      machine.currentState as PlayerMovementState,
      player.facing as PlayerFacing,
    );

    const current = GetComponent(player.id, PLAYER_ANIMATION_COMPONENT_ID) as
      | AnimationComponent
      | undefined;

    if (current?.animation === newAnimation) return;

    AddComponent(
      player.id,
      ComponentFactory.create(AnimationComponent, {
        id: PLAYER_ANIMATION_COMPONENT_ID,
        resource: PLAYER_ANIMATION_RESOURCE,
        animation: newAnimation,
        playing: true,
        frameRate: PLAYER_ANIMATION_FRAME_RATE,
        size: new Vector3(64, 96, 0),
      }),
    );
  }

  private getMovementDirection(sessionId: string): Vector3 {
    const direction = new Vector3(0, 0, 0);

    if (this.input.isDown(sessionId, 'move.up')) direction.y -= 1;
    if (this.input.isDown(sessionId, 'move.down')) direction.y += 1;
    if (this.input.isDown(sessionId, 'move.left')) direction.x -= 1;
    if (this.input.isDown(sessionId, 'move.right')) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    return direction;
  }
}
