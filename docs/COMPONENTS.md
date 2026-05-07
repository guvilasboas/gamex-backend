# Arquitetura: `engine-entities-components`

## Contexto e análise da engine existente

### O que já existe (scaffolding)

O submódulo `engine-entities-components` já foi criado com a estrutura base, mas está incompleto:

| Arquivo | Estado atual |
|---|---|
| `component.ts` | Classe base vazia: `export class Component {}` |
| `component-factory.ts` | `ComponentFactory.create<T>(Class, params)` via `plainToInstance` — funcional |
| `engine-entities-components.registry.ts` | Extends `EngineRegistry<string, Component>` — estrutura incorreta para o uso pretendido |
| `engine-entities-components.manager.ts` | `@Injectable()` vazio — sem métodos |
| `engine-entities-components.module.ts` | `@Global()` module com registry + manager registrados e exportados |
| `index.ts` | Exports corretos dos cinco arquivos acima |

O módulo já está importado em `EngineEntitiesModule` e ambos os providers são exportados como `@Global()`.

### O problema com o `EngineRegistry<string, Component>` atual

`EngineRegistry<string, Component>` é uma estrutura `Map<string, Component>` plana. Para um sistema de componentes funcionar corretamente, precisamos de:

1. `GetComponent(entityId, HealthComponent)` — busca por tipo, retorno tipado: **O(1)**
2. `GetAllComponents(entityId)` — todos os componentes de uma entidade: **O(1)**
3. `removeAll(entityId)` — cascade ao deletar entidade: **O(1)**

A estrutura correta é `Map<entityId, Map<ComponentClass, Component>>` — não compatível com o `EngineRegistry` base. O registry precisa ser **reescrito** com armazenamento próprio, seguindo o mesmo padrão de `EngineEntitiesRegistry` e `EngineCollidersRegistry`, que também não usam `EngineRegistry` internamente.

### Padrões da engine que este módulo deve seguir

| Padrão | Como se aplica aqui |
|---|---|
| **Registry = armazenamento puro** | Sem lógica, sem eventos — apenas `Map<entityId, Map<Class, Component>>` |
| **Manager = CRUD com side effects** | Emite eventos de ciclo de vida dos componentes |
| **System = lógica reativa** | Escuta `ENGINE_ENTITY_DELETED_EVENT` para cascade automático |
| **SDK via Container** | `AddComponent`, `GetComponent`, etc. como funções globais |
| **`@Global()` module** | Já configurado — componentes devem estar disponíveis sem import explícito |

### Por que um sistema de componentes?

A `Entity` tem campos fixos (`position`, `size`, `velocity`, `facing`, `tags`). Para extender entidades com dados específicos de jogo sem herança proliferante — `PlayerEntity extends Entity`, `EnemyEntity extends Entity`, `BossEntity extends PlayerEntity` etc. — o padrão ECS usa componentes como bolsas de dados plugáveis:

```
Entity (dados universais: position, velocity, tags)
  ├── HealthComponent     { current: 80, max: 100 }
  ├── StaminaComponent    { current: 50, max: 50 }
  ├── InventoryComponent  { slots: [...] }
  └── StatusEffects       { effects: ['burning', 'slowed'] }
```

Cada tipo de sistema processa apenas as entidades que possuem os componentes que lhe interessam. Um `HealthSystem` só precisa de entidades com `HealthComponent`. O resultado é composição em vez de herança, e sistemas desacoplados que não sabem uns dos outros.

---

## Arquivos que precisam ser modificados ou criados

```
src/lib/engine/engine-entities/engine-entities-components/
├── component.ts                                   ← MODIFICAR (adicionar metadados)
├── component-factory.ts                           ← manter como está
├── engine-entities-components.events.ts           ← CRIAR (eventos de ciclo de vida)
├── engine-entities-components.registry.ts         ← REESCREVER (nova estrutura de mapa)
├── engine-entities-components.manager.ts          ← IMPLEMENTAR (CRUD + eventos)
├── engine-entities-components.system.ts           ← CRIAR (cascade delete + store sync)
├── engine-entities-components.sdk.ts              ← CRIAR (funções imperativas)
├── engine-entities-components.module.ts           ← MODIFICAR (adicionar System)
└── index.ts                                       ← MODIFICAR (exportar novos arquivos)
```

---

## Implementação de cada arquivo

### `component.ts` — MODIFICAR

A classe base recebe um campo `entityId` obrigatório, tornando cada instância autocontida (sabe a qual entidade pertence, como `Collider`). O campo estático `type` fornece uma chave string canônica para serialização e logs — derivada do nome da classe por padrão, mas sobrescritível.

```typescript
export abstract class Component {
  /**
   * ID da entidade à qual este componente pertence.
   * Preenchido automaticamente por AddComponent.
   */
  entityId: string;

  /**
   * Chave de tipo canônica para serialização.
   * Por padrão, é o nome da classe. Pode ser sobrescrita em subclasses:
   *   static readonly type = 'health';
   */
  static readonly type: string;

  /**
   * Getter de instância que delega para o static type da subclasse.
   */
  get type(): string {
    return (this.constructor as typeof Component).type ?? this.constructor.name;
  }
}
```

**Exemplo de componente concreto:**

```typescript
export class HealthComponent extends Component {
  static readonly type = 'health';

  current: number = 100;
  max: number = 100;
  regenPerTick: number = 0;
}
```

---

### `engine-entities-components.events.ts` — CRIAR

```typescript
/**
 * Emitido quando um componente é adicionado a uma entidade.
 * Payload: Component
 */
export const ENGINE_ENTITY_COMPONENT_ADDED_EVENT = 'engine.entity.component.added';

/**
 * Emitido quando um componente existente é atualizado via ReplaceComponent ou UpdateComponent.
 * Payload: { previous: Component; next: Component }
 */
export const ENGINE_ENTITY_COMPONENT_UPDATED_EVENT = 'engine.entity.component.updated';

/**
 * Emitido quando um componente específico é removido de uma entidade.
 * Payload: Component (a instância removida, antes da remoção)
 */
export const ENGINE_ENTITY_COMPONENT_REMOVED_EVENT = 'engine.entity.component.removed';
```

---

### `engine-entities-components.registry.ts` — REESCREVER

A chave interna usa `Function` (a própria classe construtora do componente), garantindo unicidade de tipo por entidade e lookups O(1) tipados.

```typescript
import { Injectable } from '@nestjs/common';
import { Component } from './component';

@Injectable()
export class EngineEntitiesComponentsRegistry {
  /**
   * entityId → (ComponentClass → Component instance)
   *
   * Uma entidade só pode ter uma instância de cada tipo de componente.
   * A chave interna é a própria classe construtora (Function), garantindo
   * O(1) por tipo sem depender de strings frágeis.
   */
  private readonly components: Map<string, Map<Function, Component>> = new Map();

  /**
   * Registra um componente para uma entidade.
   * Se já existir um componente do mesmo tipo, ele é substituído.
   */
  add(component: Component): void {
    if (!this.components.has(component.entityId)) {
      this.components.set(component.entityId, new Map());
    }
    this.components.get(component.entityId)!.set(component.constructor, component);
  }

  /**
   * Retorna o componente de tipo T para uma entidade, ou undefined se não existir.
   */
  get<T extends Component>(entityId: string, componentClass: new (...args: any[]) => T): T | undefined {
    return this.components.get(entityId)?.get(componentClass) as T | undefined;
  }

  /**
   * Retorna todos os componentes de uma entidade, em ordem de inserção.
   */
  getAll(entityId: string): Component[] {
    const map = this.components.get(entityId);
    if (!map) return [];
    return Array.from(map.values());
  }

  /**
   * Verifica se uma entidade possui um componente de tipo T.
   */
  has<T extends Component>(entityId: string, componentClass: new (...args: any[]) => T): boolean {
    return this.components.get(entityId)?.has(componentClass) ?? false;
  }

  /**
   * Remove um componente específico de uma entidade.
   * Retorna a instância removida, ou undefined se não existia.
   */
  remove<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): T | undefined {
    const entityMap = this.components.get(entityId);
    if (!entityMap) return undefined;

    const instance = entityMap.get(componentClass) as T | undefined;
    entityMap.delete(componentClass);

    if (entityMap.size === 0) {
      this.components.delete(entityId);
    }

    return instance;
  }

  /**
   * Remove todos os componentes de uma entidade.
   * Retorna as instâncias removidas (útil para emitir eventos de remoção em cascade).
   */
  removeAll(entityId: string): Component[] {
    const entityMap = this.components.get(entityId);
    if (!entityMap) return [];
    const removed = Array.from(entityMap.values());
    this.components.delete(entityId);
    return removed;
  }
}
```

---

### `engine-entities-components.manager.ts` — IMPLEMENTAR

O manager é a única porta de entrada para mutações do registry. Toda operação de escrita passa por aqui, garantindo que os eventos de ciclo de vida sempre sejam emitidos.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineEntitiesComponentsRegistry } from './engine-entities-components.registry';
import { Component } from './component';
import {
  ENGINE_ENTITY_COMPONENT_ADDED_EVENT,
  ENGINE_ENTITY_COMPONENT_REMOVED_EVENT,
  ENGINE_ENTITY_COMPONENT_UPDATED_EVENT,
} from './engine-entities-components.events';

@Injectable()
export class EngineEntitiesComponentsManager {
  constructor(
    @Inject(EngineEntitiesComponentsRegistry)
    private readonly registry: EngineEntitiesComponentsRegistry,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Adiciona um componente a uma entidade.
   * Se já existir um componente do mesmo tipo, ele é substituído e o evento de update é emitido.
   * Caso contrário, o evento de added é emitido.
   */
  add(component: Component): void {
    const existing = this.registry.get(component.entityId, component.constructor as any);

    this.registry.add(component);

    if (existing) {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_UPDATED_EVENT, {
        previous: existing,
        next: component,
      });
    } else {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_ADDED_EVENT, component);
    }
  }

  /**
   * Retorna o componente de tipo T de uma entidade.
   */
  get<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): T | undefined {
    return this.registry.get(entityId, componentClass);
  }

  /**
   * Retorna todos os componentes de uma entidade.
   */
  getAll(entityId: string): Component[] {
    return this.registry.getAll(entityId);
  }

  /**
   * Verifica se uma entidade possui um componente de tipo T.
   */
  has<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): boolean {
    return this.registry.has(entityId, componentClass);
  }

  /**
   * Remove um componente específico de uma entidade.
   * Emite o evento de removed com a instância que foi removida.
   */
  remove<T extends Component>(
    entityId: string,
    componentClass: new (...args: any[]) => T,
  ): void {
    const removed = this.registry.remove(entityId, componentClass);
    if (removed) {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_REMOVED_EVENT, removed);
    }
  }

  /**
   * Remove todos os componentes de uma entidade.
   * Emite ENGINE_ENTITY_COMPONENT_REMOVED_EVENT para cada componente removido.
   * Chamado automaticamente pelo EngineEntitiesComponentsSystem ao deletar entidade.
   */
  removeAll(entityId: string): void {
    const removed = this.registry.removeAll(entityId);
    for (const component of removed) {
      this.eventEmitter.emit(ENGINE_ENTITY_COMPONENT_REMOVED_EVENT, component);
    }
  }
}
```

---

### `engine-entities-components.system.ts` — CRIAR

Responsável por um único comportamento: limpeza automática de todos os componentes quando uma entidade é deletada, evitando vazamentos de memória.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENGINE_ENTITY_DELETED_EVENT, Entity } from '../';
import { EngineEntitiesComponentsManager } from './engine-entities-components.manager';

@Injectable()
export class EngineEntitiesComponentsSystem {
  constructor(
    @Inject(EngineEntitiesComponentsManager)
    private readonly manager: EngineEntitiesComponentsManager,
  ) {}

  /**
   * Ao deletar uma entidade, remove todos os seus componentes.
   * O manager emite ENGINE_ENTITY_COMPONENT_REMOVED_EVENT para cada um,
   * permitindo que outros sistemas reajam à remoção individual se necessário.
   */
  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEntityDeleted(entity: Entity): void {
    this.manager.removeAll(entity.id);
  }
}
```

**Por que o cascade emite eventos individuais de remoção?**

Se um sistema de jogo (ex.: `StatusEffectsSystem`) escuta `ENGINE_ENTITY_COMPONENT_REMOVED_EVENT` para fazer cleanup próprio, ele deve ser notificado mesmo quando a entidade é deletada. Emitir eventos individuais garante que não há casos especiais: `remove(entityId, SomeClass)` e `removeAll(entityId)` têm o mesmo comportamento observável do ponto de vista dos consumidores.

---

### `engine-entities-components.sdk.ts` — CRIAR

Funções imperativas que seguem exatamente o padrão de `engine-entities.sdk.ts` e `engine-collisions.sdk.ts`.

```typescript
import { Container } from '../../../../common/container';
import { EngineEntitiesComponentsManager } from './engine-entities-components.manager';
import { Component } from './component';
import { ComponentFactory } from './component-factory';

// ─── Gerenciamento de componentes ─────────────────────────────────────────────

/**
 * Adiciona um componente a uma entidade.
 * Se já existir um componente do mesmo tipo, ele é substituído.
 *
 * @example
 * AddComponent(player.id, ComponentFactory.create(HealthComponent, { current: 100, max: 100 }));
 */
export function AddComponent<T extends Component>(entityId: string, component: T): T {
  const manager = Container.get<EngineEntitiesComponentsManager>(EngineEntitiesComponentsManager);
  component.entityId = entityId;
  manager.add(component);
  return component;
}

/**
 * Retorna o componente de tipo T de uma entidade, ou undefined se não existir.
 *
 * @example
 * const health = GetComponent(player.id, HealthComponent);
 * if (health) health.current -= 10;
 */
export function GetComponent<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
): T | undefined {
  const manager = Container.get<EngineEntitiesComponentsManager>(EngineEntitiesComponentsManager);
  return manager.get(entityId, componentClass);
}

/**
 * Verifica se uma entidade possui um componente de tipo T.
 *
 * @example
 * if (HasComponent(entityId, BurningComponent)) { ... }
 */
export function HasComponent<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
): boolean {
  const manager = Container.get<EngineEntitiesComponentsManager>(EngineEntitiesComponentsManager);
  return manager.has(entityId, componentClass);
}

/**
 * Remove um componente específico de uma entidade.
 * No-op silencioso se o componente não existir.
 */
export function RemoveComponent<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
): void {
  const manager = Container.get<EngineEntitiesComponentsManager>(EngineEntitiesComponentsManager);
  manager.remove(entityId, componentClass);
}

/**
 * Retorna todos os componentes de uma entidade.
 */
export function GetAllComponents(entityId: string): Component[] {
  const manager = Container.get<EngineEntitiesComponentsManager>(EngineEntitiesComponentsManager);
  return manager.getAll(entityId);
}

// ─── Atalho: criar e adicionar em uma operação ────────────────────────────────

/**
 * Cria e imediatamente adiciona um componente a uma entidade.
 * Equivale a: AddComponent(entityId, ComponentFactory.create(Class, params))
 *
 * @example
 * AttachComponent(player.id, HealthComponent, { current: 100, max: 100 });
 */
export function AttachComponent<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
  params: Partial<T> = {},
): T {
  const component = ComponentFactory.create(componentClass, params);
  return AddComponent(entityId, component);
}

// ─── Atalho: atualizar campos de um componente existente ─────────────────────

/**
 * Atualiza campos de um componente existente e re-registra (emitindo update event).
 * No-op silencioso se o componente não existir.
 *
 * @example
 * PatchComponent(player.id, HealthComponent, { current: health.current - 10 });
 */
export function PatchComponent<T extends Component>(
  entityId: string,
  componentClass: new (...args: any[]) => T,
  changes: Partial<T>,
): void {
  const manager = Container.get<EngineEntitiesComponentsManager>(EngineEntitiesComponentsManager);
  const existing = manager.get(entityId, componentClass);
  if (!existing) return;
  Object.assign(existing, changes);
  manager.add(existing); // re-registra para emitir o evento de updated
}
```

---

### `engine-entities-components.module.ts` — MODIFICAR

Adicionar o `EngineEntitiesComponentsSystem` aos providers:

```typescript
import { Global, Module } from '@nestjs/common';
import { EngineEntitiesComponentsRegistry } from './engine-entities-components.registry';
import { EngineEntitiesComponentsManager } from './engine-entities-components.manager';
import { EngineEntitiesComponentsSystem } from './engine-entities-components.system';  // ← novo

@Global()
@Module({
  providers: [
    EngineEntitiesComponentsRegistry,
    EngineEntitiesComponentsManager,
    EngineEntitiesComponentsSystem,  // ← novo
  ],
  exports: [
    EngineEntitiesComponentsRegistry,
    EngineEntitiesComponentsManager,
  ],
})
export class EngineEntitiesComponentsModule {}
```

> `EngineEntitiesComponentsSystem` não é exportado porque é um consumidor de eventos, não um serviço reutilizável externamente.

---

### `index.ts` — MODIFICAR

```typescript
export * from './component';
export * from './component-factory';
export * from './engine-entities-components.events';
export * from './engine-entities-components.manager';
export * from './engine-entities-components.module';
export * from './engine-entities-components.registry';
export * from './engine-entities-components.sdk';
// EngineEntitiesComponentsSystem é interno, não exportado pelo index
```

---

## Sincronização com o cliente (considerações)

Ao contrário de `RenderNode` e `Collider`, componentes são **dados de lógica de jogo** — não têm representação visual direta nem semântica de física. A decisão de sincronizar com o cliente é **contextual por componente**, não universal.

### Componentes que tipicamente NÃO precisam ser sincronizados

- `InventoryComponent` — processado em ações específicas do jogador
- `StatusEffectsComponent` — o visual do efeito é um `RenderNode`, não o componente em si
- `CombatStatsComponent` — dados internos de balanceamento

### Componentes que tipicamente PRECISAM ser sincronizados

- `HealthComponent` — o cliente precisa saber o HP atual para exibir a barra de vida
- Qualquer componente cuja mudança deve atualizar a UI do cliente em tempo real

### Padrão recomendado: sincronização opt-in por sistema

Em vez de sincronizar todos os componentes (o que seria ruim para segurança e tráfego), crie um sistema dedicado que escuta eventos específicos de componente e emite patches ao store:

```typescript
// game/game-health.system.ts (na camada de jogo, não na engine)
@Injectable()
export class GameHealthSyncSystem {
  constructor(
    @Inject(EngineStoreManager)
    private readonly storeManager: EngineStoreManager,
  ) {}

  @OnEvent(ENGINE_ENTITY_COMPONENT_ADDED_EVENT)
  @OnEvent(ENGINE_ENTITY_COMPONENT_UPDATED_EVENT)
  onComponentChanged(eventPayload: Component | { previous: Component; next: Component }): void {
    const component = 'next' in eventPayload ? eventPayload.next : eventPayload;
    if (!(component instanceof HealthComponent)) return;

    this.storeManager.patch({
      type: 'set',
      key: `entities.${component.entityId}.health`,
      value: { current: component.current, max: component.max },
    });
  }
}
```

Isso mantém o `EngineEntitiesComponentsModule` agnóstico de store e permite que cada jogo decida quais dados chegam ao cliente.

---

## Fluxo de execução

### Adição de componente

```
Código do jogo chama: AttachComponent(player.id, HealthComponent, { current: 100, max: 100 })
  → ComponentFactory.create(HealthComponent, { ... }) → instância
  → AddComponent(player.id, instance)
      → component.entityId = player.id
      → EngineEntitiesComponentsManager.add(component)
          → EngineEntitiesComponentsRegistry.add(component)
          → EventEmitter.emit('engine.entity.component.added', component)
                │
                └─→ [GameHealthSyncSystem, StatusEffectsSystem, etc.] reagem se registrados
```

### Cascade ao deletar entidade

```
EngineEntitiesManager.remove(entityId)
  → EventEmitter.emit('engine.entity.deleted', entity)
        │
        ├─→ EngineStoreSystem.onEngineEntityDeleted(entity)
        │     → patch({ type: 'delete', key: 'entities.{id}' })
        │
        ├─→ EngineRenderNodesSystem.onEntityDeleted(entity)       [se engine-render estiver ativo]
        │     → remove todos os render nodes + patches
        │
        └─→ EngineEntitiesComponentsSystem.onEntityDeleted(entity)
              → manager.removeAll(entity.id)
                  → para cada componente removido:
                      EventEmitter.emit('engine.entity.component.removed', component)
```

---

## Como usar no código de jogo

### 1. Definir componentes de jogo

```typescript
// packages/game/src/components/health.component.ts
import { Component } from '@engine/engine-entities';

export class HealthComponent extends Component {
  static readonly type = 'health';

  current: number = 100;
  max: number = 100;
  regenPerTick: number = 0;
}

// packages/game/src/components/stamina.component.ts
export class StaminaComponent extends Component {
  static readonly type = 'stamina';

  current: number = 50;
  max: number = 50;
}

// packages/game/src/components/status-effects.component.ts
export class StatusEffectsComponent extends Component {
  static readonly type = 'status_effects';

  effects: string[] = []; // ex.: ['burning', 'slowed']
}
```

### 2. Criar um player com componentes

```typescript
// game-players.loader.ts
import { AttachComponent } from '@engine/engine-entities';

export function loadPlayer(playerId: string) {
  const player = CreateEntity(/* ... */);

  AttachComponent(player.id, HealthComponent, { current: 100, max: 100 });
  AttachComponent(player.id, StaminaComponent, { current: 50, max: 50 });
  AttachComponent(player.id, StatusEffectsComponent);

  return player;
}
```

### 3. Sistema que processa somente entidades com HealthComponent

```typescript
@Injectable()
export class HealthRegenSystem {
  @OnEvent(GAME_UPDATE_EVENT)
  onUpdate(): void {
    for (const entity of GetEntitiesWithComponent(HealthComponent)) {
      const health = GetComponent(entity.id, HealthComponent);
      if (!health || health.current >= health.max) continue;
      if (health.regenPerTick <= 0) continue;

      PatchComponent(entity.id, HealthComponent, {
        current: Math.min(health.current + health.regenPerTick, health.max),
      });
    }
  }
}
```

> **Nota**: `GetEntitiesWithComponent` não existe ainda no scaffold atual — ver seção de extensões abaixo.

### 4. Reagir a dano recebido

```typescript
@Injectable()
export class GameCombatSystem {

  @OnEvent('session.action.attack')
  onAttack(session: EngineSession, action: AttackAction): void {
    const target = GetEntity(action.targetId);
    if (!target || !HasComponent(target.id, HealthComponent)) return;

    PatchComponent(target.id, HealthComponent, (health) => ({
      current: Math.max(0, health.current - action.damage),
    }));

    if (GetComponent(target.id, HealthComponent)!.current === 0) {
      RemoveEntity(target.id);
    }
  }
}
```

### 5. Aplicar e remover efeito de status

```typescript
function applyBurning(entityId: string): void {
  const status = GetComponent(entityId, StatusEffectsComponent);
  if (!status || status.effects.includes('burning')) return;

  PatchComponent(entityId, StatusEffectsComponent, {
    effects: [...status.effects, 'burning'],
  });

  // Efeito visual via render engine
  AddRenderNode({
    id: 'effect_burn',
    entityId,
    zIndex: 1,
    data: { type: 'animation', texture: 'effects', animation: 'burn_loop', playing: true },
  });
}

function removeBurning(entityId: string): void {
  const status = GetComponent(entityId, StatusEffectsComponent);
  if (!status) return;

  PatchComponent(entityId, StatusEffectsComponent, {
    effects: status.effects.filter((e) => e !== 'burning'),
  });

  RemoveRenderNode(entityId, 'effect_burn');
}
```

---

## Extensão futura: `GetEntitiesWithComponent`

O padrão ECS completo requer consultar entidades por componente. Isso exige um índice reverso: `ComponentClass → Set<entityId>`. É uma extensão natural do registry, mas não está no escopo da implementação mínima.

Quando necessário, adicionar ao `EngineEntitiesComponentsRegistry`:

```typescript
// Extensão futura no registry — índice reverso para queries ECS
private readonly componentIndex: Map<Function, Set<string>> = new Map();

// Atualizar add() para manter o índice:
add(component: Component): void {
  // ... código atual ...
  if (!this.componentIndex.has(component.constructor)) {
    this.componentIndex.set(component.constructor, new Set());
  }
  this.componentIndex.get(component.constructor)!.add(component.entityId);
}

// Nova consulta:
getEntitiesWith<T extends Component>(componentClass: new (...args: any[]) => T): string[] {
  return Array.from(this.componentIndex.get(componentClass) ?? []);
}
```

E no SDK:

```typescript
export function GetEntitiesWithComponent<T extends Component>(
  componentClass: new (...args: any[]) => T,
): Entity[] {
  const registry = Container.get<EngineEntitiesComponentsRegistry>(EngineEntitiesComponentsRegistry);
  const manager = Container.get<EngineEntitiesManager>(EngineEntitiesManager);
  return registry.getEntitiesWith(componentClass)
    .map((id) => manager.get(id))
    .filter(Boolean) as Entity[];
}
```

---

## Diagrama de dependências

```
EngineEntitiesComponentsModule (@Global)
├── providers
│   ├── EngineEntitiesComponentsRegistry  (entityId → ClassConstructor → Component)
│   ├── EngineEntitiesComponentsManager   (CRUD + eventos; única porta de entrada para mutações)
│   │   ├── injects: EngineEntitiesComponentsRegistry
│   │   └── injects: EventEmitter2
│   └── EngineEntitiesComponentsSystem    (cascade delete ao ENGINE_ENTITY_DELETED_EVENT)
│       └── injects: EngineEntitiesComponentsManager
└── exports
    ├── EngineEntitiesComponentsRegistry
    └── EngineEntitiesComponentsManager

EngineEntitiesModule (existente — sem alteração além do import que já existe)
└── imports: EngineEntitiesComponentsModule  (já configurado)
```

---

## Decisões de design e justificativas

| Decisão | Justificativa |
|---|---|
| **`Map<entityId, Map<Function, Component>>`** | O(1) por tipo e por entidade. A classe construtora como chave é mais confiável que strings (`HealthComponent.name` pode ser minificado em produção). |
| **Uma instância por tipo por entidade** | Invariante fundamental do modelo de componentes. `HealthComponent` é um slot único, como uma propriedade. Se múltiplas instâncias forem necessárias, o componente deve ser uma lista (`effects: string[]`) não múltiplos componentes. |
| **`entityId` dentro do `Component`** | Autocontido como `Collider`. Permite que o system de cascade itere componentes removidos e emita eventos sem precisar re-passar o entityId. |
| **Manager emite eventos individuais em `removeAll`** | Sistemas externos que escutam `ENGINE_ENTITY_COMPONENT_REMOVED_EVENT` não precisam de lógica especial para o caso de deleção de entidade — a interface é uniforme. |
| **SDK tem `AttachComponent` e `PatchComponent`** | `AttachComponent` elimina o `ComponentFactory.create + AddComponent` repetitivo. `PatchComponent` cobre o padrão mais comum: ler, mutar, regravar. |
| **Sincronização ao store é opt-in por sistema de jogo** | Diferentes componentes têm diferentes requisitos de visibilidade no cliente. Sincronizar tudo seria ineficiente e um risco de segurança (dados internos de balanceamento expostos). |
| **`EngineEntitiesComponentsSystem` não é exportado** | É um listener interno. Código externo não tem razão para injetá-lo diretamente. |
| **`ComponentFactory` mantido sem alteração** | Já é funcional e seguirá sendo o mecanismo padrão de instanciação. `plainToInstance` garante que decorators `class-transformer` (`@Type`, `@Exclude`, etc.) sejam respeitados nos componentes. |
