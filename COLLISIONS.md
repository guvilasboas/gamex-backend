# Arquitetura: `engine-collisions`

## Contexto e análise da engine existente

Antes de definir a arquitetura, é necessário entender os padrões já estabelecidos na engine:

| Padrão | Descrição |
|---|---|
| **Module/Manager/Registry/System** | Cada submódulo segue este quarteto de responsabilidades |
| **EventEmitter2** | Toda comunicação entre módulos é feita via eventos |
| **Game loop em fases** | `BEFORE_UPDATE → UPDATE → AFTER_UPDATE → BEFORE_RENDER → RENDER → AFTER_RENDER` |
| **Chunk spatial partitioning** | O mundo é dividido em chunks de 1024 unidades; entidades são indexadas por chunk |
| **Tags nas entidades** | `Entity.tags: string[]` é o mecanismo de categorização já existente |
| **SDK via Container** | Funções imperativas globais (`CreateEntity`, `UpdateEntity`, etc.) acessam serviços via `Container.get()` |
| **Global modules** | `EngineEntitiesModule` é `@Global()`, portanto disponível sem import explícito |

A `Entity` já carrega tudo que é necessário para detecção de colisões:
- `position: Vector3` — posição no mundo
- `size: Vector3` — dimensões (bounding box)
- `velocity: Vector3` — velocidade atual
- `tags: string[]` — categorias (usado para filtros de colisão)
- `chunkId: string` — localização espacial atual (derivado de `position`)

---

## Estrutura de arquivos proposta

```
src/lib/engine/engine-collisions/
├── index.ts
├── engine-collisions.module.ts
├── engine-collisions.system.ts
├── engine-collisions.manager.ts
├── engine-collisions.registry.ts
├── engine-collisions.events.ts
├── engine-collisions.types.ts
├── engine-collisions.sdk.ts
├── collider.ts                          ← shape individual de colisão
├── engine-colliders.registry.ts         ← colliders indexados por entidade
├── engine-colliders.system.ts           ← limpeza automática ao deletar entidade
└── detectors/
    ├── collision-detector.interface.ts
    └── aabb.detector.ts
```

---

## Responsabilidades de cada arquivo

### `collider.ts`

Representa um shape individual de colisão vinculado a uma entidade. Uma entidade pode ter múltiplos colliders (ex.: `body`, `hitbox`, `hurtbox`).

```typescript
import { Vector3 } from 'three';

export type ColliderShape = 'aabb'; // extensível: 'circle' | 'obb' | ...

export class Collider {
  /**
   * Identificador único do collider dentro da entidade.
   * Ex.: 'body', 'hitbox', 'hurtbox', ou um UUID.
   */
  id: string;

  /**
   * ID da entidade proprietária.
   */
  entityId: string;

  /**
   * Offset em relação à posição da entidade.
   * Permite posicionar o collider fora do centro da entidade.
   */
  offset: Vector3 = new Vector3(0, 0, 0);

  /**
   * Dimensões do collider (independente do size da entidade).
   */
  size: Vector3;

  /**
   * Formato geométrico do collider.
   */
  shape: ColliderShape = 'aabb';

  /**
   * Tags do collider para filtragem semântica.
   * Ex.: ['hitbox'], ['hurtbox'], ['trigger']
   */
  tags: string[] = [];

  /**
   * Quando false, o collider é ignorado na detecção.
   */
  enabled: boolean = true;

  constructor(params: Partial<Collider> & { id: string; entityId: string; size: Vector3 }) {
    Object.assign(this, params);
  }

  /**
   * Retorna a posição absoluta do centro do collider no mundo,
   * somando o offset à posição atual da entidade.
   */
  getWorldPosition(entityPosition: Vector3): Vector3 {
    return entityPosition.clone().add(this.offset);
  }
}
```

---

### `engine-collisions.types.ts`

Define os tipos centrais do módulo. Nenhuma dependência de NestJS.

```typescript
import { Vector3 } from 'three';
import { Entity } from '../engine-entities';
import { Collider } from './collider';

/**
 * Chave canônica que identifica de forma única um par de COLLIDERS entre entidades.
 * Formato: "entityA_id:colliderA_id::entityB_id:colliderB_id"
 * Os dois lados são sempre ordenados lexicograficamente para garantir unicidade.
 */
export type CollisionPairKey = string;

export const createCollisionPairKey = (
  entityAId: string,
  colliderAId: string,
  entityBId: string,
  colliderBId: string,
): CollisionPairKey => {
  const sideA = `${entityAId}:${colliderAId}`;
  const sideB = `${entityBId}:${colliderBId}`;
  return [sideA, sideB].sort().join('::');
};

/**
 * Resultado do cálculo de colisão entre dois colliders de entidades distintas.
 * Identifica precisamente qual collider de cada entidade foi ativado.
 */
export type CollisionManifold = {
  entityA: Entity;
  entityB: Entity;
  /** Collider de entityA que participou da colisão. */
  colliderA: Collider;
  /** Collider de entityB que participou da colisão. */
  colliderB: Collider;
  /** Vetor de sobreposição por eixo (penetração em x, y, z) */
  overlap: Vector3;
  /** Normal da colisão (direção de separação mínima) */
  normal: Vector3;
  /** Profundidade de penetração (menor valor entre os eixos sobrepostos) */
  depth: number;
};

/**
 * Define quais combinações de tags de COLLIDER podem colidir entre si.
 * Filtra por collider.tags, não por entity.tags.
 * Se a lista de filtros estiver vazia, todos os colliders colidem com todos.
 */
export type CollisionFilter = {
  tagA: string;
  tagB: string;
};
```

---

### `engine-collisions.events.ts`

Seguindo o padrão de `engine-entities.events.ts` e `engine-sessions.events.ts`.

```typescript
/**
 * Emitido no primeiro frame em que duas entidades se sobrepõem.
 * Payload: CollisionManifold
 */
export const ENGINE_COLLISION_ENTER_EVENT = 'engine.collision.enter';

/**
 * Emitido em todos os frames subsequentes enquanto duas entidades
 * permanecem sobrepostas (após o enter).
 * Payload: CollisionManifold
 */
export const ENGINE_COLLISION_STAY_EVENT = 'engine.collision.stay';

/**
 * Emitido no frame em que duas entidades deixam de se sobrepor.
 * Payload: { entityAId: string; entityBId: string }
 */
export const ENGINE_COLLISION_EXIT_EVENT = 'engine.collision.exit';
```

---

### `engine-colliders.registry.ts`

Armazena os colliders de cada entidade. Pertence ao módulo `engine-collisions` pois colliders são dados de colisão, não de entidade.

```typescript
import { Injectable } from '@nestjs/common';
import { Collider } from './collider';

@Injectable()
export class EngineCollidersRegistry {
  /**
   * Mapa de entityId → lista de colliders da entidade.
   */
  private readonly colliders: Map<string, Collider[]> = new Map();

  add(collider: Collider): void {
    const list = this.colliders.get(collider.entityId) ?? [];
    const index = list.findIndex((c) => c.id === collider.id);
    if (index !== -1) {
      list[index] = collider; // substitui se já existe com mesmo id
    } else {
      list.push(collider);
    }
    this.colliders.set(collider.entityId, list);
  }

  remove(entityId: string, colliderId: string): void {
    const list = this.colliders.get(entityId);
    if (!list) return;
    const filtered = list.filter((c) => c.id !== colliderId);
    if (filtered.length === 0) {
      this.colliders.delete(entityId);
    } else {
      this.colliders.set(entityId, filtered);
    }
  }

  /** Remove todos os colliders de uma entidade (chamado ao deletar a entidade). */
  removeAll(entityId: string): void {
    this.colliders.delete(entityId);
  }

  getByEntity(entityId: string): Collider[] {
    return this.colliders.get(entityId) ?? [];
  }

  getAll(): Collider[] {
    return Array.from(this.colliders.values()).flat();
  }
}
```

---

### `engine-colliders.system.ts`

Responsável por limpar os colliders automaticamente quando uma entidade é removida.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENGINE_ENTITY_DELETED_EVENT, Entity } from '../engine-entities';
import { EngineCollidersRegistry } from './engine-colliders.registry';

@Injectable()
export class EngineCollidersSystem {
  constructor(
    @Inject(EngineCollidersRegistry)
    private readonly collidersRegistry: EngineCollidersRegistry,
  ) {}

  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEntityDeleted(entity: Entity): void {
    this.collidersRegistry.removeAll(entity.id);
  }
}
```

---

### `detectors/collision-detector.interface.ts`

Interface que permite plugar diferentes algoritmos de detecção (padrão Strategy).
Opera sobre **colliders**, não diretamente sobre entidades.

```typescript
import { Entity } from '../../engine-entities';
import { Collider } from '../collider';
import { CollisionManifold } from '../engine-collisions.types';

export interface ICollisionDetector {
  /**
   * Verifica se dois colliders (de entidades distintas) se sobrepõem.
   * Retorna o manifold com os dados físicos da colisão, ou null se não há sobreposição.
   *
   * @param entityA - Entidade proprietária de colliderA
   * @param colliderA - Collider da entidade A a ser testado
   * @param entityB - Entidade proprietária de colliderB
   * @param colliderB - Collider da entidade B a ser testado
   */
  detect(
    entityA: Entity,
    colliderA: Collider,
    entityB: Entity,
    colliderB: Collider,
  ): CollisionManifold | null;
}
```

---

### `detectors/aabb.detector.ts`

Implementação padrão: Axis-Aligned Bounding Box em 2D (x/z, ignorando y para jogos top-down).
Usa a **posição absoluta do collider** (`collider.getWorldPosition(entity.position)`) e `collider.size`.

```typescript
import { Injectable } from '@nestjs/common';
import { Vector3 } from 'three';
import { Entity } from '../../engine-entities';
import { Collider } from '../collider';
import { CollisionManifold } from '../engine-collisions.types';
import { ICollisionDetector } from './collision-detector.interface';

@Injectable()
export class AabbDetector implements ICollisionDetector {
  detect(
    entityA: Entity,
    colliderA: Collider,
    entityB: Entity,
    colliderB: Collider,
  ): CollisionManifold | null {
    // Posições absolutas dos colliders no mundo
    const posA = colliderA.getWorldPosition(entityA.position);
    const posB = colliderB.getWorldPosition(entityB.position);

    // Half-extents de cada collider
    const halfA = colliderA.size.clone().multiplyScalar(0.5);
    const halfB = colliderB.size.clone().multiplyScalar(0.5);

    // Distância entre centros (operando em 2D: x e z)
    const dx = posA.x - posB.x;
    const dz = posA.z - posB.z;

    const overlapX = halfA.x + halfB.x - Math.abs(dx);
    const overlapZ = halfA.z + halfB.z - Math.abs(dz);

    // Se qualquer sobreposição for negativa, não há colisão
    if (overlapX <= 0 || overlapZ <= 0) {
      return null;
    }

    // Eixo de menor penetração determina a normal
    let normal: Vector3;
    let depth: number;

    if (overlapX < overlapZ) {
      depth = overlapX;
      normal = new Vector3(dx < 0 ? 1 : -1, 0, 0);
    } else {
      depth = overlapZ;
      normal = new Vector3(0, 0, dz < 0 ? 1 : -1);
    }

    return {
      entityA,
      entityB,
      colliderA,
      colliderB,
      overlap: new Vector3(overlapX, 0, overlapZ),
      normal,
      depth,
    };
  }
}
```

**Por que AABB?** AABB é O(1) por par e suficiente para jogos 2D/top-down. A interface `ICollisionDetector` permite substituir por `CircleDetector`, `ObbDetector`, etc. sem alterar o manager.

---

### `engine-collisions.registry.ts`

Armazena o estado de colisões do frame atual por **par de colliders** (não mais por par de entidades), permitindo detectar transições enter/stay/exit com granularidade de collider.

```typescript
import { Injectable } from '@nestjs/common';
import { CollisionFilter, CollisionManifold, CollisionPairKey } from './engine-collisions.types';

@Injectable()
export class EngineCollisionsRegistry {
  /**
   * Colisões ativas no frame corrente.
   * Chave: CollisionPairKey ("entityA:colliderA::entityB:colliderB")
   */
  readonly activeCollisions: Map<CollisionPairKey, CollisionManifold> = new Map();

  /**
   * Filtros por tags de COLLIDER.
   * Se vazio, todos os colliders colidem com todos (desde que a entidade tenha tag 'collidable').
   */
  readonly filters: CollisionFilter[] = [];

  add(key: CollisionPairKey, manifold: CollisionManifold): void {
    this.activeCollisions.set(key, manifold);
  }

  remove(key: CollisionPairKey): void {
    this.activeCollisions.delete(key);
  }

  has(key: CollisionPairKey): boolean {
    return this.activeCollisions.has(key);
  }

  get(key: CollisionPairKey): CollisionManifold | undefined {
    return this.activeCollisions.get(key);
  }

  getAll(): CollisionManifold[] {
    return Array.from(this.activeCollisions.values());
  }

  getAllKeys(): CollisionPairKey[] {
    return Array.from(this.activeCollisions.keys());
  }

  /** Retorna todas as colisões ativas que envolvem uma entidade específica. */
  getByEntity(entityId: string): CollisionManifold[] {
    return this.getAll().filter(
      (m) => m.entityA.id === entityId || m.entityB.id === entityId,
    );
  }

  /** Retorna todas as colisões ativas que envolvem um collider específico. */
  getByCollider(entityId: string, colliderId: string): CollisionManifold[] {
    return this.getAll().filter(
      (m) =>
        (m.entityA.id === entityId && m.colliderA.id === colliderId) ||
        (m.entityB.id === entityId && m.colliderB.id === colliderId),
    );
  }

  addFilter(filter: CollisionFilter): void {
    const already = this.filters.some(
      (f) =>
        (f.tagA === filter.tagA && f.tagB === filter.tagB) ||
        (f.tagA === filter.tagB && f.tagB === filter.tagA),
    );
    if (!already) {
      this.filters.push(filter);
    }
  }

  removeFilter(tagA: string, tagB: string): void {
    const index = this.filters.findIndex(
      (f) =>
        (f.tagA === tagA && f.tagB === tagB) ||
        (f.tagA === tagB && f.tagB === tagA),
    );
    if (index !== -1) {
      this.filters.splice(index, 1);
    }
  }

  hasFilters(): boolean {
    return this.filters.length > 0;
  }
}
```

---

### `engine-collisions.manager.ts`

Orquestra a lógica de negócio. O loop de detecção agora opera em **pares de colliders** (não pares de entidades):
- Broad phase: pares de entidades via chunks (como antes)
- Narrow phase: para cada par de entidades, testa **todas as combinações** de colliders (collidersA × collidersB)

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineEntitiesRegistry } from '../engine-entities';
import { EngineChunksRegistry } from '../engine-chunks';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollidersRegistry } from './engine-colliders.registry';
import { AabbDetector } from './detectors/aabb.detector';
import {
  ENGINE_COLLISION_ENTER_EVENT,
  ENGINE_COLLISION_EXIT_EVENT,
  ENGINE_COLLISION_STAY_EVENT,
} from './engine-collisions.events';
import {
  CollisionPairKey,
  createCollisionPairKey,
} from './engine-collisions.types';
import { Entity } from '../engine-entities';
import { Collider } from './collider';

export type CollisionExitPayload = {
  entityAId: string;
  colliderAId: string;
  entityBId: string;
  colliderBId: string;
};

@Injectable()
export class EngineCollisionsManager {
  constructor(
    @Inject(EngineEntitiesRegistry)
    private readonly entitiesRegistry: EngineEntitiesRegistry,
    @Inject(EngineChunksRegistry)
    private readonly chunksRegistry: EngineChunksRegistry,
    @Inject(EngineCollisionsRegistry)
    private readonly collisionsRegistry: EngineCollisionsRegistry,
    @Inject(EngineCollidersRegistry)
    private readonly collidersRegistry: EngineCollidersRegistry,
    @Inject(AabbDetector)
    private readonly detector: AabbDetector,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Ponto de entrada principal: executado a cada frame pelo System.
   *
   * Fluxo:
   * 1. Broad phase  — pares de entidades candidatos via chunks
   * 2. Narrow phase — para cada par de entidades, testa collidersA × collidersB
   * 3. Reconciliação — determina enter/stay/exit por par de colliders
   */
  detectAndEmit(): void {
    const currentFrameKeys = new Set<CollisionPairKey>();

    for (const [entityA, entityB] of this.broadPhase()) {
      const collidersA = this.collidersRegistry.getByEntity(entityA.id).filter((c) => c.enabled);
      const collidersB = this.collidersRegistry.getByEntity(entityB.id).filter((c) => c.enabled);

      if (collidersA.length === 0 || collidersB.length === 0) {
        continue;
      }

      // Narrow phase: testa todas as combinações de colliders entre as duas entidades
      for (const colliderA of collidersA) {
        for (const colliderB of collidersB) {
          if (!this.colliderPassesFilter(colliderA, colliderB)) {
            continue;
          }

          const manifold = this.detector.detect(entityA, colliderA, entityB, colliderB);
          if (!manifold) {
            continue;
          }

          const key = createCollisionPairKey(
            entityA.id, colliderA.id,
            entityB.id, colliderB.id,
          );
          currentFrameKeys.add(key);

          if (this.collisionsRegistry.has(key)) {
            this.collisionsRegistry.add(key, manifold);
            this.eventEmitter.emit(ENGINE_COLLISION_STAY_EVENT, manifold);
          } else {
            this.collisionsRegistry.add(key, manifold);
            this.eventEmitter.emit(ENGINE_COLLISION_ENTER_EVENT, manifold);
          }
        }
      }
    }

    // Pares que estavam ativos mas não aparecem neste frame → EXIT
    for (const existingKey of this.collisionsRegistry.getAllKeys()) {
      if (!currentFrameKeys.has(existingKey)) {
        const [sideA, sideB] = existingKey.split('::');
        const [entityAId, colliderAId] = sideA.split(':');
        const [entityBId, colliderBId] = sideB.split(':');
        this.collisionsRegistry.remove(existingKey);
        this.eventEmitter.emit(ENGINE_COLLISION_EXIT_EVENT, {
          entityAId,
          colliderAId,
          entityBId,
          colliderBId,
        } satisfies CollisionExitPayload);
      }
    }
  }

  /**
   * Broad phase usando o sistema de chunks existente.
   * Produz pares únicos de entidades que estão em chunks próximos.
   * A entidade precisa ter a tag 'collidable' para ser candidata.
   */
  private broadPhase(): [Entity, Entity][] {
    const checkedEntityPairs = new Set<string>();
    const pairs: [Entity, Entity][] = [];

    for (const chunk of this.chunksRegistry.getAll()) {
      const entityIds = new Set([
        ...Array.from(chunk.entities),
        ...this.getNeighboringEntityIds(chunk.neighboringChunkIds),
      ]);

      const entities = Array.from(entityIds)
        .map((id) => this.entitiesRegistry.get(id))
        .filter((e): e is Entity => e !== undefined && e.tags.includes('collidable'));

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const pairKey = [entities[i].id, entities[j].id].sort().join('::');
          if (!checkedEntityPairs.has(pairKey)) {
            checkedEntityPairs.add(pairKey);
            pairs.push([entities[i], entities[j]]);
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Verifica se um par de colliders deve ser testado segundo os filtros de tag.
   * Os filtros agora operam sobre collider.tags, não entity.tags.
   *
   * Se não há filtros, todos os pares de colliders são testados.
   */
  private colliderPassesFilter(colliderA: Collider, colliderB: Collider): boolean {
    if (!this.collisionsRegistry.hasFilters()) {
      return true;
    }

    return this.collisionsRegistry.filters.some(
      (f) =>
        (colliderA.tags.includes(f.tagA) && colliderB.tags.includes(f.tagB)) ||
        (colliderA.tags.includes(f.tagB) && colliderB.tags.includes(f.tagA)),
    );
  }

  private getNeighboringEntityIds(neighboringChunkIds: string[]): string[] {
    return neighboringChunkIds.flatMap((chunkId) => {
      const chunk = this.chunksRegistry.get(chunkId);
      return chunk ? Array.from(chunk.entities) : [];
    });
  }
}
```

---

### `engine-collisions.system.ts`

Integra o manager ao game loop. Ouve `GAME_AFTER_UPDATE_EVENT` — após todos os sistemas de movimento terem rodado em `GAME_UPDATE_EVENT`.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GAME_AFTER_UPDATE_EVENT } from '../engine.events';
import { EngineCollisionsManager } from './engine-collisions.manager';

@Injectable()
export class EngineCollisionsSystem {
  constructor(
    @Inject(EngineCollisionsManager)
    private readonly collisionsManager: EngineCollisionsManager,
  ) {}

  /**
   * Executa a detecção de colisões após todos os sistemas de movimento
   * terem atualizado as posições das entidades.
   */
  @OnEvent(GAME_AFTER_UPDATE_EVENT)
  onGameAfterUpdate(): void {
    this.collisionsManager.detectAndEmit();
  }
}
```

**Por que `GAME_AFTER_UPDATE_EVENT`?**  
Os sistemas de movimentação devem rodar em `GAME_UPDATE_EVENT` (ex.: aplicar `velocity` à `position`). As colisões são detectadas após todas as posições estarem atualizadas, garantindo que os eventos de colisão reflitam o estado do mundo naquele frame.

---

### `engine-collisions.sdk.ts`

Funções imperativas que seguem o padrão de `engine-entities.sdk.ts` e `engine-sessions.sdk.ts`.
Inclui gerenciamento de colliders e consultas de colisão com granularidade de collider.

```typescript
import { Vector3 } from 'three';
import { Container } from '../../../common/container';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollidersRegistry } from './engine-colliders.registry';
import { Collider, ColliderShape } from './collider';
import { CollisionManifold, createCollisionPairKey } from './engine-collisions.types';

// ─── Gerenciamento de Colliders ───────────────────────────────────────────────

/**
 * Adiciona (ou substitui) um collider em uma entidade.
 *
 * @example
 * AddCollider({
 *   id: 'body',
 *   entityId: player.id,
 *   size: new Vector3(32, 0, 32),
 *   tags: ['hurtbox'],
 * });
 *
 * AddCollider({
 *   id: 'sword',
 *   entityId: player.id,
 *   size: new Vector3(16, 0, 48),
 *   offset: new Vector3(24, 0, 0),
 *   tags: ['hitbox'],
 * });
 */
export function AddCollider(
  params: { id: string; entityId: string; size: Vector3 } & Partial<Collider>,
): Collider {
  const registry = Container.get<EngineCollidersRegistry>(EngineCollidersRegistry);
  const collider = new Collider(params);
  registry.add(collider);
  return collider;
}

/**
 * Remove um collider específico de uma entidade.
 */
export function RemoveCollider(entityId: string, colliderId: string): void {
  const registry = Container.get<EngineCollidersRegistry>(EngineCollidersRegistry);
  registry.remove(entityId, colliderId);
}

/**
 * Retorna todos os colliders de uma entidade.
 */
export function GetColliders(entityId: string): Collider[] {
  const registry = Container.get<EngineCollidersRegistry>(EngineCollidersRegistry);
  return registry.getByEntity(entityId);
}

/**
 * Habilita ou desabilita um collider específico sem removê-lo.
 */
export function SetColliderEnabled(entityId: string, colliderId: string, enabled: boolean): void {
  const registry = Container.get<EngineCollidersRegistry>(EngineCollidersRegistry);
  const collider = registry.getByEntity(entityId).find((c) => c.id === colliderId);
  if (collider) {
    collider.enabled = enabled;
  }
}

// ─── Consulta de colisões ─────────────────────────────────────────────────────

/**
 * Retorna todas as colisões ativas de uma entidade no frame corrente.
 * Inclui qual collider de cada lado foi ativado.
 */
export function GetActiveCollisions(entityId: string): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  return registry.getByEntity(entityId);
}

/**
 * Retorna todas as colisões ativas de um collider específico.
 */
export function GetColliderCollisions(entityId: string, colliderId: string): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  return registry.getByCollider(entityId, colliderId);
}

/**
 * Verifica se dois colliders específicos estão atualmente colidindo.
 */
export function AreCollidersColliding(
  entityAId: string,
  colliderAId: string,
  entityBId: string,
  colliderBId: string,
): boolean {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  return registry.has(createCollisionPairKey(entityAId, colliderAId, entityBId, colliderBId));
}

// ─── Filtros de colisão ───────────────────────────────────────────────────────

/**
 * Registra um filtro de colisão por tags de COLLIDER.
 * Apenas colliders com tagA podem colidir com colliders com tagB.
 * Ativar ao menos um filtro habilita o modo de filtragem.
 *
 * @example
 * // Apenas hitbox de player pode colidir com hurtbox de enemy
 * AddCollisionFilter('hitbox', 'hurtbox');
 */
export function AddCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  registry.addFilter({ tagA, tagB });
}

/**
 * Remove um filtro de colisão previamente registrado.
 */
export function RemoveCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  registry.removeFilter(tagA, tagB);
}
```

---

### `engine-collisions.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { EngineCollisionsManager } from './engine-collisions.manager';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollisionsSystem } from './engine-collisions.system';
import { EngineCollidersRegistry } from './engine-colliders.registry';
import { EngineCollidersSystem } from './engine-colliders.system';
import { AabbDetector } from './detectors/aabb.detector';

@Module({
  providers: [
    EngineCollisionsRegistry,
    EngineCollidersRegistry,
    EngineCollisionsManager,
    EngineCollisionsSystem,
    EngineCollidersSystem,
    AabbDetector,
  ],
  exports: [
    EngineCollisionsRegistry,
    EngineCollidersRegistry,
    EngineCollisionsManager,
  ],
})
export class EngineCollisionsModule {}
```

---

### `index.ts`

```typescript
export * from './collider';
export * from './engine-colliders.registry';
export * from './engine-collisions.events';
export * from './engine-collisions.manager';
export * from './engine-collisions.module';
export * from './engine-collisions.registry';
export * from './engine-collisions.sdk';
export * from './engine-collisions.types';
```

---

### Integração em `engine.module.ts`

```typescript
// Adicionar ao array de imports:
import { EngineCollisionsModule } from './engine-collisions';

@Module({
  imports: [
    EngineEntitiesModule,
    EngineSessionsModule,
    EngineChunksModule,
    EngineDebugModule,
    EngineStoreModule,
    EngineCollisionsModule,   // <-- novo
  ],
  providers: [Engine, EngineStepper],
  exports: [Engine, EngineStepper],
})
export class EngineModule {}
```

---

## Fluxo de execução por frame

```
ENGINE_STEP_EVENT (EngineStepper)
        │
        ▼
GAME_BEFORE_UPDATE
  └─ EngineSessionSystem: processa actions da fila
        │
        ▼
GAME_UPDATE
  └─ [MovementSystem, etc.]: aplica velocity → position, emite ENGINE_ENTITY_UPDATED_EVENT
  └─ EngineChunksSystem: re-indexa entidades que mudaram de chunk
        │
        ▼
GAME_AFTER_UPDATE
  └─ EngineCollisionsSystem.onGameAfterUpdate()
        │
        ├─ broadPhase(): pares candidatos via chunks
        ├─ passesFilter(): filtra por tag 'collidable' + filtros opcionais
        ├─ AabbDetector.detect(): narrow phase por par
        └─ reconcilia com frame anterior:
              ├─ novo par      → emit ENGINE_COLLISION_ENTER_EVENT
              ├─ par existente → emit ENGINE_COLLISION_STAY_EVENT
              └─ par removido  → emit ENGINE_COLLISION_EXIT_EVENT
        │
        ▼
GAME_BEFORE_RENDER → GAME_RENDER → GAME_AFTER_RENDER
```

---

## Sistema de resolução de colisões (opcional, separado)

Caso seja necessário mover entidades para fora de outras (física de sólidos), criar um sistema separado que escuta os eventos de colisão. Isso mantém detecção e resolução desacoplados.

```typescript
// engine-collision-resolution.system.ts

@Injectable()
export class EngineCollisionResolutionSystem {
  constructor(
    private readonly entitiesManager: EngineEntitiesManager,
  ) {}

  @OnEvent(ENGINE_COLLISION_ENTER_EVENT)
  @OnEvent(ENGINE_COLLISION_STAY_EVENT)
  onCollision(manifold: CollisionManifold): void {
    const { entityA, entityB, normal, depth } = manifold;

    // Cada entidade recebe metade da correção (assume massas iguais)
    const correction = normal.clone().multiplyScalar(depth / 2);

    const updatedA = GetEntity(entityA.id);
    const updatedB = GetEntity(entityB.id);

    if (updatedA) {
      updatedA.position.add(correction);
      UpdateEntity(updatedA);
    }

    if (updatedB) {
      updatedB.position.sub(correction);
      UpdateEntity(updatedB);
    }
  }
}
```

> Este sistema deve ser registrado no módulo do jogo, não no `EngineCollisionsModule`, pois é lógica de gameplay — não de engine.

---

## Como usar no código de jogo

### 1. Criar uma entidade colidível com múltiplos colliders

```typescript
// A entidade só precisa da tag 'collidable' — o size da entidade
// não é mais usado para colisão; cada collider tem seu próprio size.
const player = CreateEntity(
  plainToInstance(PlayerEntity, {
    id: uuid(),
    position: new Vector3(100, 0, 100),
    size: new Vector3(32, 0, 32), // usado para renderização/outros sistemas
    velocity: new Vector3(0, 0, 0),
    tags: ['collidable', 'player'],
  })
);

// Collider de corpo (hurtbox) — centralizado na entidade
AddCollider({
  id: 'body',
  entityId: player.id,
  size: new Vector3(28, 0, 28),
  tags: ['hurtbox'],
});

// Collider de ataque (hitbox) — offset à frente da entidade
AddCollider({
  id: 'sword',
  entityId: player.id,
  size: new Vector3(16, 0, 40),
  offset: new Vector3(0, 0, -34),
  tags: ['hitbox'],
  enabled: false, // desativado por padrão; ativo apenas durante o ataque
});
```

### 2. Ativar/desativar colliders dinamicamente

```typescript
// Durante animação de ataque:
SetColliderEnabled(player.id, 'sword', true);

// Ao terminar a animação:
SetColliderEnabled(player.id, 'sword', false);
```

### 3. Reagir a colisões identificando o collider ativado

```typescript
@Injectable()
export class PlayerCombatSystem {

  @OnEvent(ENGINE_COLLISION_ENTER_EVENT)
  onCollisionEnter(manifold: CollisionManifold): void {
    const { entityA, entityB, colliderA, colliderB } = manifold;

    // Identifica qual lado é o atacante e qual é o alvo
    const isAHitting = colliderA.tags.includes('hitbox') && colliderB.tags.includes('hurtbox');
    const isBHitting = colliderB.tags.includes('hitbox') && colliderA.tags.includes('hurtbox');

    if (isAHitting) {
      // entityA acertou entityB com colliderA (ex: 'sword')
      console.log(`${entityA.id} acertou ${entityB.id} com collider '${colliderA.id}'`);
    } else if (isBHitting) {
      // entityB acertou entityA
      console.log(`${entityB.id} acertou ${entityA.id} com collider '${colliderB.id}'`);
    }
  }
}
```

### 4. Filtros por tag de collider

```typescript
// Apenas hitbox pode atingir hurtbox — body não colide com body entre entidades
AddCollisionFilter('hitbox', 'hurtbox');
// body ainda pode colidir com obstáculos do cenário
AddCollisionFilter('hurtbox', 'wall');
```

### 5. Consultas imperativas

```typescript
// Todas as colisões ativas da entidade (qualquer collider)
const allCollisions = GetActiveCollisions(playerId);

// Colisões ativas apenas do collider 'sword'
const swordHits = GetColliderCollisions(playerId, 'sword');

// Verifica se dois colliders específicos estão colidindo agora
const hitting = AreCollidersColliding(playerId, 'sword', enemyId, 'body');
```

---

## Diagrama de dependências

```
EngineCollisionsModule
├── providers
│   ├── EngineCollidersRegistry    (colliders por entidade: id → Collider[])
│   ├── EngineCollisionsRegistry   (colisões ativas por par de colliders + filters)
│   ├── AabbDetector               (algoritmo: (entity,collider) × (entity,collider) → manifold)
│   ├── EngineCollisionsManager    (broad phase + narrow phase collidersA×collidersB + eventos)
│   │   ├── injects: EngineEntitiesRegistry  (@Global, já disponível)
│   │   ├── injects: EngineChunksRegistry    (via EngineChunksModule)
│   │   ├── injects: EngineCollisionsRegistry
│   │   ├── injects: EngineCollidersRegistry
│   │   ├── injects: AabbDetector
│   │   └── injects: EventEmitter2
│   ├── EngineCollisionsSystem     (hook em GAME_AFTER_UPDATE)
│   │   └── injects: EngineCollisionsManager
│   └── EngineCollidersSystem      (limpa colliders em ENGINE_ENTITY_DELETED_EVENT)
│       └── injects: EngineCollidersRegistry
└── exports
    ├── EngineCollidersRegistry
    ├── EngineCollisionsRegistry
    └── EngineCollisionsManager
```

---

## Decisões de design e justificativas

| Decisão | Justificativa |
|---|---|
| **Colliders separados da `Entity`** | A classe `Entity` não precisa saber sobre shapes de colisão; `EngineCollidersRegistry` é dono dos colliders |
| **Múltiplos colliders por entidade** | Permite hitbox/hurtbox/body/trigger distintos por entidade com tamanhos e offsets independentes |
| **`colliderA`/`colliderB` no manifold** | O consumidor sabe exatamente qual shape colidiu, sem precisar inferir via tags manualmente |
| **`CollisionPairKey` inclui collider ID** | Garante granularidade: a mesma entidade pode ter entrar/sair independentemente por cada collider |
| **Filtros por `collider.tags`** | Mais expressivo que filtros por `entity.tags`: permite `hitbox ↔ hurtbox` sem afetar `body ↔ wall` |
| **`EngineCollidersSystem` limpa colliders** | Evita vazamento de memória ao deletar entidades; segue o mesmo padrão do `EngineChunksSystem` |
| **`enabled` no collider** | Permite ativar/desativar hitboxes de ataque dinamicamente sem remover e recriar o collider |
| **Tag `collidable` como opt-in na entidade** | Broad phase já filtra entidades sem tag `collidable`; se a entidade não tem a tag, seus colliders nunca são testados |
| **Broad phase via chunks** | Reutiliza o índice espacial existente; evita duplicar estrutura de aceleração |
| **AABB opera sobre `collider.size` + `offset`** | Não depende mais de `entity.size`; cada collider tem suas próprias dimensões |
| **Interface `ICollisionDetector`** | Permite plugar `CircleDetector`, `ObbDetector`, etc. sem alterar o manager |
| **Enter/Stay/Exit** | Padrão consagrado (Unity/Godot); cada par de colliders tem seu próprio ciclo de vida |
| **Resolução em sistema separado** | A engine detecta; o jogo decide o que fazer com cada tipo de colisão |
| **SDK via `Container.get()`** | Consistente com `engine-entities.sdk.ts` e `engine-sessions.sdk.ts` |
