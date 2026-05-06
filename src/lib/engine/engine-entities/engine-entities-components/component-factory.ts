import { ClassConstructor, plainToInstance } from 'class-transformer';

export class ComponentFactory {
  /**
   * Creates an instance of a component from a plain object.
   *
   * @param {ClassConstructor<T>} componentClass The class constructor of the component to create.
   * @param {Partial<T>} params The plain object containing the properties to initialize the component instance.
   * @returns {T} An instance of the specified component class.
   */
  static create<T>(componentClass: ClassConstructor<T>, params: Partial<T>): T {
    return plainToInstance(componentClass, params);
  }
}
