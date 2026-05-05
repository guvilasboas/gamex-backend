import { Vector3 } from 'three';
import { Entity } from '../../lib/engine/engine-entities';

export class GamePlayer extends Entity {
  /**
   * The type of the entity, which is set to 'player' for game players.
   *
   * @type {string}
   */
  type = 'player';

  /**
   * The size of the player entity, which is set to a default value of (30, 60, 0).
   *
   * @type {Vector3}
   */
  size = new Vector3(64, 96, 0);
}
