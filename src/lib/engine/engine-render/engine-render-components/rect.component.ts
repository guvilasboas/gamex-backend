import { Component } from '../../engine-entities/engine-entities-components';
import { Renderable } from '../engine-render-decorators';

@Renderable()
export class RectComponent extends Component {
  static readonly type = '[Rect]';

  /**
   * The stroke color of the rectangle. Default is '#FF0000' (red).
   *
   * @type {string}
   */
  strokeColor: string = '#FF0000';

  /**
   * The stroke width of the rectangle.
   *
   * @type {number}
   */
  strokeWidth: number = 1;

  /**
   * The fill color of the rectangle. If not set, the rectangle will not be filled.
   *
   * @type {string | undefined}
   */
  fillColor?: string;

  /**
   * Sets the stroke color of the rectangle.
   *
   * @param {string} color - The stroke color of the rectangle
   */
  setStrokeColor(color: string) {
    this.strokeColor = color;
  }

  /**
   * Gets the stroke color of the rectangle.
   *
   * @returns {string} The stroke color of the rectangle
   */
  getStrokeColor() {
    return this.strokeColor;
  }

  /**
   * Sets the fill color of the rectangle.
   *
   * @param {string} color - The fill color of the rectangle
   */
  setFillColor(color: string) {
    this.fillColor = color;
  }

  /**
   * Gets the fill color of the rectangle.
   *
   * @returns {string | undefined} The fill color of the rectangle
   */
  getFillColor() {
    return this.fillColor;
  }

  /**
   * Sets the stroke width of the rectangle.
   *
   * @param {number} width - The stroke width of the rectangle
   */
  setStrokeWidth(width: number) {
    this.strokeWidth = width;
  }

  /**
   * Gets the stroke width of the rectangle.
   *
   * @returns {number} The stroke width of the rectangle
   */
  getStrokeWidth() {
    return this.strokeWidth;
  }
}
