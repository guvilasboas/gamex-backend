import { Vector3 } from 'three';

export enum Direction {
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right',
}

export type Directions = {
  [Direction.Up]: boolean;
  [Direction.Down]: boolean;
  [Direction.Left]: boolean;
  [Direction.Right]: boolean;
};

/**
 * Converts a movement vector into directional booleans.
 *
 * @param vector The movement vector to convert.
 * @returns An object containing boolean values for each direction.
 */
export function GetDirectionsFromVector(vector: Vector3): Directions {
  return {
    [Direction.Up]: vector.y < 0,
    [Direction.Down]: vector.y > 0,
    [Direction.Left]: vector.x < 0,
    [Direction.Right]: vector.x > 0,
  };
}

/**
 * Converts directional booleans into a normalized movement vector.
 *
 * @param directions An object containing boolean values for each direction.
 * @returns A normalized movement vector based on the input directions.
 */
export function GetVectorFromDirections(directions: Directions) {
  const vector = new Vector3(0, 0, 0);

  if (directions[Direction.Up]) {
    vector.y -= 1;
  }
  if (directions[Direction.Down]) {
    vector.y += 1;
  }
  if (directions[Direction.Left]) {
    vector.x -= 1;
  }
  if (directions[Direction.Right]) {
    vector.x += 1;
  }

  if (vector.lengthSq() > 0) {
    vector.normalize();
  }
  return vector;
}

/**
 * Converts a single direction into a movement vector.
 *
 * @param direction The direction to convert.
 * @returns A movement vector corresponding to the input direction.
 */
export function GetVectorFromDirection(direction: Direction) {
  const vector = new Vector3(0, 0, 0);

  if (direction === Direction.Up) {
    vector.y -= 1;
  }
  if (direction === Direction.Down) {
    vector.y += 1;
  }
  if (direction === Direction.Left) {
    vector.x -= 1;
  }
  if (direction === Direction.Right) {
    vector.x += 1;
  }

  return vector;
}
