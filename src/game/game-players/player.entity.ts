import { Vector3 } from 'three';
import { Entity } from '../../lib/engine/engine-entities';
import { EntityDef, WithComponent } from '../../lib/engine/engine-decorators';
import { ColliderComponent } from '../../lib/engine/engine-collisions';
import { RectComponent } from '../../lib/engine/engine-render';
import { random, uniqueId } from 'lodash';

@EntityDef({ type: 'player' })
@WithComponent(ColliderComponent, {
  id: 'body',
  size: new Vector3(64, 24, 0),
  tags: ['player'],
})
@WithComponent(RectComponent, () => ({
  id: uniqueId('player-rect'),
  size: new Vector3(64, 96, 0),
}))
export class Player extends Entity {
  size = new Vector3(64, 96, 0);

  position = new Vector3(random(0, 500), random(0, 500), 0);

  speed = 5;
}
