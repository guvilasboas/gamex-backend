/**
 * Marks a Component subclass with a canonical type string.
 *
 * Equivalent to declaring `static readonly type = '...'` on the class, but
 * expressed as a decorator for better discoverability and tooling support.
 *
 * @example
 * @ComponentType('health')
 * export class HealthComponent extends Component { ... }
 */
export function ComponentType(type: string): ClassDecorator {
  return (constructor) => {
    Reflect.defineMetadata('component:type', type, constructor);
    (constructor as any).type = type;
  };
}

/**
 * Returns the component type string registered via @ComponentType, or
 * undefined if the class was not decorated.
 */
export function GetComponentType(
  componentClass: new (...args: any[]) => any,
): string | undefined {
  return Reflect.getMetadata('component:type', componentClass);
}
