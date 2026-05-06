import { BaseRenderComponent } from './base-render.component';
import { Renderable } from '../engine-render-decorators';

@Renderable()
export class AnimationComponent extends BaseRenderComponent {
  static readonly type = '[Animation]';
}
