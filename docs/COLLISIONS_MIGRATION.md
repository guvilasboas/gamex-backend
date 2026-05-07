# Migração: `engine-collisions` → sistema de componentes

## Objetivo

Substituir o `EngineCollidersRegistry` e a classe `Collider` dedicados por um `ColliderComponent` que usa o sistema de componentes (`engine-entities-components`). O resultado é que colisões passam a ser configuradas com `AttachComponent` / `AddComponent` como qualquer outro dado de entidade, e o módulo `engine-collisions` perde o `EngineCollidersRegistry` e `EngineCollidersSystem` que mantinha separadamente.

---

## O que muda, o que fica

| Item | Situação após a migração |
|---|---|
| `collider.ts` | **Substituído** por `collider.component.ts` (extends `Component`) |
| `engine-colliders.registry.ts` | **Removido** — lookup feito via `EngineEntitiesComponentsManager` |
| `engine-colliders.system.ts` | **Removido** — cascade delete já é feito por `EngineEntitiesComponentsSystem` |
| `engine-collisions.manager.ts` | **Modificado** — troca `EngineCollidersRegistry` por `EngineEntitiesComponentsManager` |
| `engine-collisions.module.ts` | **Modificado** — remove os dois providers/exports acima |
| `engine-collisions.sdk.ts` | **Modificado** — `AddCollider` vira wrapper de `AttachComponent`; remove `RemoveCollider`/`GetColliders`/`SetColliderEnabled` (substituídos pelo SDK de componentes) |
| `engine-collisions.types.ts` | **Modificado** — `CollisionManifold` passa a referenciar `ColliderComponent` |
| `detectors/aabb.detector.ts` | **Modificado** — assinatura troca `Collider` por `ColliderComponent` |
| `detectors/collision-detector.interface.ts` | **Modificado** — mesma troca de tipo |
| `index.ts` | **Modificado** — não exporta mais `EngineCollidersRegistry` |
| `EngineEntitiesComponentsModule` | **Sem alteração** — já está em `@Global()` e disponível |

---

## Passo 1 — Criar `collider.component.ts`

O `ColliderComponent` substitui `Collider`. Herda de `Component` (ganha `id` e `entityId` automáticos) e mantém exatamente os mesmos campos de física.

```typescript
// engine-collisions/collider.component.ts
import { Vector3 } from 'three';
import { Component } from '../engine-entities/engine-entities-components';

export type ColliderShape = 'aabb';

export class ColliderComponent extends Component {
  static readonly type = 'collider';

  offset: Vector3 = new Vector3(0, 0, 0);
  size: Vector3;
  shape: ColliderShape = 'aabb';
  tags: string[] = [];
  enabled: boolean = true;

  constructor(
    params: Partial<ColliderComponent> & { id: string; entityId: string; size: Vector3 },
  ) {
    super({ id: params.id });
    Object.assign(this, params);
  }

  getWorldPosition(entityPosition: Vector3): Vector3 {
    return entityPosition.clone().add(this.offset);
  }
}
```

---

## Passo 2 — Modificar `engine-collisions.types.ts`

Trocar a referência de `Collider` para `ColliderComponent` no manifold e remover o import de `collider.ts`.

```typescript
// engine-collisions.types.ts
import { Vector3 } from 'three';
import { Entity } from '../engine-entities';
import { ColliderComponent } from './collider.component';   // ← era: './collider'

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

export type CollisionManifold = {
  entityA: Entity;
  entityB: Entity;
  colliderA: ColliderComponent;   // ← era: Collider
  colliderB: ColliderComponent;   // ← era: Collider
  overlap: Vector3;
  normal: Vector3;
  depth: number;
};

export type CollisionFilter = {
  tagA: string;
  tagB: string;
};
```

---

## Passo 3 — Modificar `detectors/collision-detector.interface.ts`

```typescript
// detectors/collision-detector.interface.ts
import { Entity } from '../../engine-entities';
import { ColliderComponent } from '../collider.component';   // ← era: '../collider'
import { CollisionManifold } from '../engine-collisions.types';

export interface ICollisionDetector {
  detect(
    entityA: Entity,
    colliderA: ColliderComponent,   // ← era: Collider
    entityB: Entity,
    colliderB: ColliderComponent,   // ← era: Collider
  ): CollisionManifold | null;
}
```

---

## Passo 4 — Modificar `detectors/aabb.detector.ts`

Apenas os tipos de parâmetro mudam. A lógica permanece idêntica — `ColliderComponent` tem os mesmos campos `size`, `offset` e `getWorldPosition`.

```typescript
// detectors/aabb.detector.ts
import { Injectable } from '@nestjs/common';
import { Vector3 } from 'three';
import { Entity } from '../../engine-entities';
import { ColliderComponent } from '../collider.component';   // ← era: '../collider'
import { CollisionManifold } from '../engine-collisions.types';
import { ICollisionDetector } from './collision-detector.interface';

@Injectable()
export class AabbDetector implements ICollisionDetector {
  detect(
    entityA: Entity,
    colliderA: ColliderComponent,   // ← era: Collider
    entityB: Entity,
    colliderB: ColliderComponent,   // ← era: Collider
  ): CollisionManifold | null {
    // corpo idêntico ao atual — nenhuma linha interna muda
  }
}
```

---

## Passo 5 — Modificar `engine-collisions.manager.ts`

Esta é a mudança central. O manager deixa de injetar `EngineCollidersRegistry` e passa a injetar `EngineEntitiesComponentsManager`. Nos dois lugares onde lê os colliders de uma entidade, o `registry.getByEntity(id)` vira `componentsManager.getByType(id, ColliderComponent)`.

**Diff conceitual:**

```typescript
// Remover:
import { EngineCollidersRegistry } from './engine-colliders.registry';
import { Collider } from './collider';

// Adicionar:
import { EngineEntitiesComponentsManager } from '../engine-entities/engine-entities-components';
import { ColliderComponent } from './collider.component';
```

```typescript
// Remover do constructor:
@Inject(EngineCollidersRegistry)
private readonly collidersRegistry: EngineCollidersRegistry,

// Adicionar:
@Inject(EngineEntitiesComponentsManager)
private readonly componentsManager: EngineEntitiesComponentsManager,
```

```typescript
// Em detectAndEmit() — era:
const collidersA = this.collidersRegistry
  .getByEntity(entityA.id)
  .filter((c) => c.enabled);
const collidersB = this.collidersRegistry
  .getByEntity(entityB.id)
  .filter((c) => c.enabled);

// Passa a ser:
const collidersA = this.componentsManager
  .getByType(entityA.id, ColliderComponent)
  .filter((c) => c.enabled);
const collidersB = this.componentsManager
  .getByType(entityB.id, ColliderComponent)
  .filter((c) => c.enabled);
```

```typescript
// Em wouldCollideAt() — era:
const collidersA = this.collidersRegistry
  .getByEntity(entityId)
  .filter((c) => c.enabled);
// ...
const collidersB = this.collidersRegistry
  .getByEntity(entityB.id)
  .filter((c) => c.enabled);

// Passa a ser:
const collidersA = this.componentsManager
  .getByType(entityId, ColliderComponent)
  .filter((c) => c.enabled);
// ...
const collidersB = this.componentsManager
  .getByType(entityB.id, ColliderComponent)
  .filter((c) => c.enabled);
```

```typescript
// Em colliderPassesFilter() — era: Collider
// Passa a ser: ColliderComponent  (mesma assinatura, só o tipo muda)
private colliderPassesFilter(
  colliderA: ColliderComponent,
  colliderB: ColliderComponent,
): boolean { /* ... sem mudança na lógica ... */ }
```

---

## Passo 6 — Modificar `engine-collisions.module.ts`

Remover `EngineCollidersRegistry`, `EngineCollidersSystem` e adicionar o import do `EngineEntitiesComponentsModule` (embora já seja `@Global()`, declarar o import explícito é boa prática quando há dependência direta).

```typescript
import { Global, Module } from '@nestjs/common';
import { EngineCollisionsManager } from './engine-collisions.manager';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollisionsSystem } from './engine-collisions.system';
import { AabbDetector } from './detectors/aabb.detector';
// ← Removidos: EngineCollidersRegistry, EngineCollidersSystem

@Global()
@Module({
  providers: [
    EngineCollisionsRegistry,
    EngineCollisionsManager,
    EngineCollisionsSystem,
    AabbDetector,
    // ← Removidos: EngineCollidersRegistry, EngineCollidersSystem
  ],
  exports: [
    EngineCollisionsRegistry,
    EngineCollisionsManager,
    // ← Removido: EngineCollidersRegistry
  ],
})
export class EngineCollisionsModule {}
```

---

## Passo 7 — Modificar `engine-collisions.sdk.ts`

`AddCollider` vira um wrapper fino de `AttachComponent` que cria um `ColliderComponent`. As funções `RemoveCollider`, `GetColliders` e `SetColliderEnabled` são **removidas** — o código de jogo passa a usar `RemoveComponent`, `GetComponentsByType` e `PatchComponent` do SDK de componentes diretamente.

```typescript
// engine-collisions.sdk.ts — versão final
import { Vector3 } from 'three';
import { Container } from '../../../common/container';
import { EngineCollisionsRegistry } from './engine-collisions.registry';
import { EngineCollisionsManager } from './engine-collisions.manager';
import { ColliderComponent } from './collider.component';
import {
  AttachComponent,
  GetComponentsByType,
  PatchComponent,
  RemoveComponent,
} from '../engine-entities/engine-entities-components';
import {
  CollisionManifold,
  createCollisionPairKey,
} from './engine-collisions.types';

// ─── Collider management ──────────────────────────────────────────────────────

/**
 * Creates and attaches a ColliderComponent to an entity.
 * Delegates to AttachComponent — consistent with all other component types.
 */
export function AddCollider(
  params: { id: string; entityId: string; size: Vector3 } & Partial<ColliderComponent>,
): ColliderComponent {
  return AttachComponent(params.entityId, ColliderComponent, params);
}

/**
 * Returns all ColliderComponents on an entity.
 * Replaces the old GetColliders() that used EngineCollidersRegistry.
 */
export function GetColliders(entityId: string): ColliderComponent[] {
  return GetComponentsByType(entityId, ColliderComponent);
}

/**
 * Removes a specific collider by id.
 */
export function RemoveCollider(entityId: string, colliderId: string): void {
  RemoveComponent(entityId, colliderId);
}

/**
 * Toggles the enabled flag of a specific collider.
 */
export function SetColliderEnabled(
  entityId: string,
  colliderId: string,
  enabled: boolean,
): void {
  PatchComponent(entityId, colliderId, { enabled });
}

// ─── Collision queries (sem alteração) ───────────────────────────────────────

export function GetActiveCollisions(entityId: string): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  return registry.getByEntity(entityId);
}

export function GetColliderCollisions(
  entityId: string,
  colliderId: string,
): CollisionManifold[] {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  return registry.getByCollider(entityId, colliderId);
}

export function AreCollidersColliding(
  entityAId: string,
  colliderAId: string,
  entityBId: string,
  colliderBId: string,
): boolean {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  return registry.has(
    createCollisionPairKey(entityAId, colliderAId, entityBId, colliderBId),
  );
}

// ─── Filtros (sem alteração) ──────────────────────────────────────────────────

export function AddCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  registry.addFilter({ tagA, tagB });
}

export function RemoveCollisionFilter(tagA: string, tagB: string): void {
  const registry = Container.get<EngineCollisionsRegistry>(EngineCollisionsRegistry);
  registry.removeFilter(tagA, tagB);
}

// ─── Especulativo (sem alteração na assinatura) ───────────────────────────────

export function WouldCollideAt(entityId: string, futurePosition: Vector3): boolean {
  const manager = Container.get<EngineCollisionsManager>(EngineCollisionsManager);
  return manager.wouldCollideAt(entityId, futurePosition);
}
```

---

## Passo 8 — Modificar `index.ts`

Substituir a exportação de `collider.ts` por `collider.component.ts` e remover `engine-colliders.registry.ts`.

```typescript
// engine-collisions/index.ts
export * from './collider.component';              // ← era: './collider'
// ← Removido: './engine-colliders.registry'
export * from './engine-collisions.events';
export * from './engine-collisions.manager';
export * from './engine-collisions.module';
export * from './engine-collisions.registry';
export * from './engine-collisions.sdk';
export * from './engine-collisions.types';
```

---

## Passo 9 — Deletar arquivos obsoletos

```
server/src/lib/engine/engine-collisions/collider.ts
server/src/lib/engine/engine-collisions/engine-colliders.registry.ts
server/src/lib/engine/engine-collisions/engine-colliders.system.ts
```

O cascade delete de colliders era responsabilidade do `EngineCollidersSystem`. Após a migração, o `EngineEntitiesComponentsSystem` (já ativo por ser `@Global()`) faz `manager.removeAll(entity.id)` ao receber `ENGINE_ENTITY_DELETED_EVENT`, o que remove os `ColliderComponent` automaticamente — cobrindo o mesmo comportamento sem código adicional.

---

## Impacto no código de jogo

O código existente que usa `AddCollider` / `RemoveCollider` / `SetColliderEnabled` **não muda** — as mesmas funções continuam exportadas pelo SDK de colisões. Internamente elas delegam para o SDK de componentes, mas a interface pública é preservada.

O único ajuste necessário em código de jogo é em imports que usem `Collider` diretamente como tipo:

```typescript
// Antes:
import { Collider } from '@server/lib/engine/engine-collisions';

// Depois:
import { ColliderComponent } from '@server/lib/engine/engine-collisions';
```

---

## Diagrama de dependências após a migração

```
EngineCollisionsModule
├── providers
│   ├── EngineCollisionsRegistry   (pares ativos: CollisionPairKey → CollisionManifold)
│   ├── AabbDetector               (algoritmo AABB — sem mudança)
│   ├── EngineCollisionsManager    (broad phase + narrow phase)
│   │   ├── injects: EngineEntitiesRegistry        (@Global)
│   │   ├── injects: EngineChunksRegistry          (@Global via EngineChunksModule)
│   │   ├── injects: EngineCollisionsRegistry
│   │   ├── injects: EngineEntitiesComponentsManager  ← substitui EngineCollidersRegistry
│   │   ├── injects: AabbDetector
│   │   └── injects: EventEmitter2
│   └── EngineCollisionsSystem     (hook em GAME_AFTER_UPDATE — sem mudança)
└── exports
    ├── EngineCollisionsRegistry
    └── EngineCollisionsManager

EngineEntitiesComponentsModule (@Global — já existente)
└── EngineEntitiesComponentsSystem
    └── onEntityDeleted → removeAll(entityId)
        └── emite ENGINE_ENTITY_COMPONENT_REMOVED_EVENT para cada ColliderComponent removido
            ↑ cobre o comportamento que era de EngineCollidersSystem
```

---

## Resumo dos arquivos alterados

| Arquivo | Ação | Motivo |
|---|---|---|
| `collider.component.ts` | Criar | Substitui `Collider`; herda `Component` |
| `collider.ts` | Deletar | Substituído por `collider.component.ts` |
| `engine-colliders.registry.ts` | Deletar | Lookup passa para `EngineEntitiesComponentsManager` |
| `engine-colliders.system.ts` | Deletar | Cascade coberto por `EngineEntitiesComponentsSystem` |
| `engine-collisions.types.ts` | Modificar | `CollisionManifold` usa `ColliderComponent` |
| `detectors/collision-detector.interface.ts` | Modificar | Tipo do parâmetro: `Collider` → `ColliderComponent` |
| `detectors/aabb.detector.ts` | Modificar | Tipo do parâmetro: `Collider` → `ColliderComponent` |
| `engine-collisions.manager.ts` | Modificar | Troca `EngineCollidersRegistry` por `EngineEntitiesComponentsManager` |
| `engine-collisions.module.ts` | Modificar | Remove os dois providers/exports deletados |
| `engine-collisions.sdk.ts` | Modificar | `AddCollider` delega para `AttachComponent` |
| `index.ts` | Modificar | Exporta `collider.component.ts`, remove `engine-colliders.registry.ts` |
