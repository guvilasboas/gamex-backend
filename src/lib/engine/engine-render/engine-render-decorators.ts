/**
 * Decorator to mark a class as renderable by the engine's rendering system.
 *
 * Usage:
 *   @Renderable()
 *   class MyRenderableClass { ... }
 *
 * This decorator adds metadata to the class that can be checked at runtime
 * to determine if an object is renderable.
 *
 * @returns {ClassDecorator} A class decorator function.
 */
export function Renderable(): ClassDecorator {
  return function (constructor: Function) {
    Reflect.defineMetadata('renderable', true, constructor);
  };
}

/**
 * Checks if the given object is an instance of a class decorated with @Renderable.
 *
 * @param object The object to check.
 * @returns True if the object's class is decorated with @Renderable, false otherwise.
 */
export function IsRenderable(object: Object): boolean {
  return !!Reflect.getMetadata('renderable', object.constructor);
}
