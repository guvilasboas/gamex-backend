import { Vector3 } from 'three';
import { Entity } from '../../lib/engine/engine-entities';
import { EntityDef, WithComponent } from '../../lib/engine/engine-decorators';
import { ColliderComponent } from '../../lib/engine/engine-collisions';
import { AnimationComponent } from '../../lib/engine/engine-render';
import { random } from 'lodash';

@EntityDef({ type: 'player' })
@WithComponent(ColliderComponent, {
  id: 'body',
  size: new Vector3(64, 24, 0),
  tags: ['player'],
})
@WithComponent(AnimationComponent, { id: 'animation' })
export class Player extends Entity {
  size = new Vector3(64, 96, 0);

  position = new Vector3(random(0, 500), random(0, 500), 0);
}
