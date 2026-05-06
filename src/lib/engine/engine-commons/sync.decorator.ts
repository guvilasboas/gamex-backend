import { Expose } from 'class-transformer';

/**
 * Marks a property as synchronized to the client (store / socket patch).
 *
 * Semantically equivalent to `@Expose()` but expresses intent ("sync this
 * field to the client") rather than the mechanism ("expose to class-transformer").
 * This decouples game domain code from the serialization library so that the
 * underlying mechanism can be swapped without touching component/entity code.
 *
 * @example
 * @ComponentType('health')
 * export class HealthComponent extends Component {
 *   @Sync() maxHp: number;
 *   @Sync() hp: number;
 *   lastDamagedBy?: string; // server-only — not sent to the client
 * }
 */
export function Sync(): PropertyDecorator {
  return (target, propertyKey) => {
    const existing: string[] = Reflect.getMetadata('sync:fields', target) ?? [];
    Reflect.defineMetadata(
      'sync:fields',
      [...existing, String(propertyKey)],
      target,
    );
    Expose()(target, propertyKey);
  };
}

/**
 * Returns the list of fields marked with @Sync on an instance's prototype.
 */
export function GetSyncFields(instance: object): string[] {
  return Reflect.getMetadata('sync:fields', instance) ?? [];
}
