import { BaseRenderComponent } from './base-render.component';
import { Renderable } from '../engine-render-decorators';

@Renderable()
export class SpriteComponent extends BaseRenderComponent {
  static readonly type = '[Sprite]';
}
