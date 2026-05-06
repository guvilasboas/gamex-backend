import { Component } from '../../engine-entities/engine-entities-components';
import { Renderable } from '../engine-render-decorators';

@Renderable()
export class SpriteComponent extends Component {
  static readonly type = '[Sprite]';
}
