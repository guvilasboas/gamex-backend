import { Injectable } from '@nestjs/common';
import { Chunk } from './chunk';

@Injectable()
export class EngineChunksRegistry {
  /**
   * A map that holds the chunks in the registry, where the key is the chunk ID and the value is the corresponding Chunk instance.
   *
   * @type {Map<string, Chunk>}
   */
  chunks: Map<string, Chunk> = new Map();

  /**
   * Retrieves all chunks currently stored in the registry.
   *
   * @returns {Chunk[]} An array of all Chunk instances in the registry.
   */
  getAll(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Adds a chunk to the registry.
   *
   * @param {Chunk} chunk The chunk instance to add to the registry.
   */
  add(chunk: Chunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  /**
   * Adds a chunk to the registry if it does not already exist.
   *
   * @param {Chunk} chunk The chunk instance to add to the registry if it does not already exist.
   */
  addIfNotExists(chunk: Chunk): void {
    if (!this.chunks.has(chunk.id)) {
      this.add(chunk);
    }
  }

  /**
   * Retrieves a chunk from the registry based on its ID.
   *
   * @param {string} id The ID of the chunk to retrieve.
   * @returns {Chunk | undefined} The chunk corresponding to the given ID, or undefined if not found.
   */
  get(id: string): Chunk | undefined {
    return this.chunks.get(id);
  }

  /**
   * Removes a chunk from the registry based on its ID.
   *
   * @param {string} id The ID of the chunk to remove.
   */
  remove(id: string): void {
    this.chunks.delete(id);
  }
}
