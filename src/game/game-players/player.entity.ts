import { Vector3 } from 'three';
import { Entity } from '../../lib/engine/engine-entities';
import { EntityDef, WithComponent } from '../../lib/engine/engine-decorators';
import { ColliderComponent } from '../../lib/engine/engine-collisions';
import { AnimationComponent } from '../../lib/engine/engine-render';
import { random } from 'lodash';
import {
  IDLE_DOWN_ANIMATION,
  PLAYER_ANIMATION_COMPONENT_ID,
  PLAYER_ANIMATION_FRAME_RATE,
  PLAYER_ANIMATION_RESOURCE,
  PlayerFacing,
} from './game-players.animation';

@EntityDef({ type: 'player' })
@WithComponent(ColliderComponent, {
  id: 'body',
  size: new Vector3(64, 24, 0),
  tags: ['player'],
})
@WithComponent(AnimationComponent, {
  id: PLAYER_ANIMATION_COMPONENT_ID,
  resource: PLAYER_ANIMATION_RESOURCE,
  animation: IDLE_DOWN_ANIMATION,
  playing: true,
  frameRate: PLAYER_ANIMATION_FRAME_RATE,
  size: new Vector3(64, 96, 0),
})
export class Player extends Entity {
  size = new Vector3(64, 96, 0);

  position = new Vector3(random(0, 500), random(0, 500), 0);

  speed = 5;

  facing: PlayerFacing = 'down';
}
