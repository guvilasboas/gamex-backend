export class EngineRegistry<ID, T> {
  /**
   * A private map that holds the registered items, where the key is the unique identifier (ID) and the value is the item of type T.
   *
   * @type {Map<ID, T>}
   */
  private registry: Map<ID, T>;

  constructor() {
    this.registry = new Map<ID, T>();
  }

  /**
   * Registers an item with a given ID.
   *
   * @param id - The unique identifier for the item.
   * @param item - The item to be registered.
   */
  register(id: ID, item: T): void {
    this.registry.set(id, item);
  }

  /**
   * Retrieves an item by its ID.
   *
   * @param id - The unique identifier of the item to retrieve.
   * @returns The item associated with the given ID, or undefined if not found.
   */
  get(id: ID): T | undefined {
    return this.registry.get(id);
  }

  /**
   * Unregisters an item by its ID.
   *
   * @param id - The unique identifier of the item to unregister.
   */
  unregister(id: ID): void {
    this.registry.delete(id);
  }

  /**
   * Checks if an item with the given ID exists in the registry.
   *
   * @param id - The unique identifier to check for existence.
   * @returns True if an item with the given ID exists, false otherwise.
   */
  has(id: ID): boolean {
    return this.registry.has(id);
  }

  /**
   * Clears all items from the registry.
   *
   * @returns void
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Queries the registry for items that match a given predicate.
   *
   * @param predicate - A function that tests each item for a condition.
   * @returns An array of items that match the predicate.
   */
  query(predicate: (item: T) => boolean): T[] {
    const results: T[] = [];
    for (const item of this.registry.values()) {
      if (predicate(item)) {
        results.push(item);
      }
    }
    return results;
  }
}
