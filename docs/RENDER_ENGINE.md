# Arquitetura: `engine-render`

## Contexto e análise da engine existente

Antes de definir a arquitetura, é necessário entender os padrões já estabelecidos na engine e como o sistema de renderização se encaixa neles:

| Padrão | Descrição |
|---|---|
| **Module/Registry/System** | Cada submódulo segue este trio de responsabilidades (Registry = armazenamento puro, System = lógica reativa) |
| **EventEmitter2** | Toda comunicação entre módulos é feita via eventos |
| **Game loop em fases** | `BEFORE_UPDATE → UPDATE → AFTER_UPDATE → BEFORE_RENDER → RENDER → AFTER_RENDER` |
| **EngineStoreManager** | Relay de patches via `ENGINE_STORE_UPDATED_EVENT`; o socket handler faz broadcast para todos os clientes |
| **EngineStoreState** | Constrói o snapshot inicial enviado em `session:init`; atualmente expõe apenas `{ entities: {...} }` |
| **SDK via Container** | Funções imperativas globais (`CreateEntity`, `AddCollider`, etc.) acessam serviços via `Container.get()` |
| **Global modules** | `EngineEntitiesModule` é `@Global()`, portanto disponível sem import explícito nos módulos filhos |

### O que já existe: a fase de Render está vazia

O game loop já reserva três fases para render (`GAME_BEFORE_RENDER_EVENT`, `GAME_RENDER_EVENT`, `GAME_AFTER_RENDER_EVENT`), mas nenhum módulo as usa. O `EngineStoreState.getSnapshot()` retorna apenas:

```typescript
{
  entities: { [id: string]: Entity }
}
```

Os clientes recebem posição, velocity, tags — mas nenhum dado visual. Para renderizar cada entidade o frontend hoje depende de convenções implícitas (ex.: inferir o sprite pelo tipo de entidade via cast).

### Por que nós precisamos de `engine-render`

Com render nodes o servidor passa a ser **a fonte da verdade visual**: ele diz exatamente _o que_ deve ser desenhado e _como_, liberando o cliente de inferências frágeis. Isso também permite:

- Efeitos visuais transientes controlados pelo servidor (flash de dano, buffs, auras)
- Camadas múltiplas por entidade sem convenções de código no cliente (corpo, sombra, healthbar, nome, efeito de status)
- Ativar/desativar nodes dinamicamente (ex.: hitbox visível no modo debug, efeito de queimadura apenas quando o jogador está com o debuff)
- Substituição de sprite em runtime (mudança de skin, evolução de personagem)

---

## Princípio fundamental

**Um `RenderNode` é para visualização o que um `Collider` é para física**: um shape independente vinculado a uma entidade, com seu próprio `offset`, `zIndex`, dados específicos de tipo e ciclo de vida autônomo.

Assim como colisões, o servidor não _renderiza_ nada — ele define e sincroniza a **árvore de nós de renderização** para cada entidade. O cliente interpreta esses dados e produz o visual.

---

## Estrutura de arquivos proposta

```
src/lib/engine/engine-render/
├── index.ts
├── engine-render.module.ts
├── engine-render.events.ts
├── engine-render.types.ts
├── render-node.ts                          ← shape visual individual
├── engine-render-nodes.registry.ts         ← nodes indexados por entidade
├── engine-render-nodes.system.ts           ← limpeza automática + sync ao store
├── engine-render.state.ts                  ← snapshot para session:init
└── engine-render.sdk.ts                    ← AddRenderNode, UpdateRenderNode, etc.
```

> Não existe `engine-render.manager.ts` porque render nodes não requerem processamento por frame: toda a lógica é reativa a mutações de estado e ao evento de deleção de entidade. O `EngineRenderNodesSystem` é suficiente como orquestrador.

---

## Responsabilidades de cada arquivo

### `render-node.ts`

Representa um nó visual individual vinculado a uma entidade. Uma entidade pode ter múltiplos nós (ex.: `body`, `shadow`, `healthbar`, `nametag`, `effect_burning`).

```typescript
import { Vector3 } from 'three';
import { RenderNodeData } from './engine-render.types';

export class RenderNode {
  /**
   * Identificador único do nó dentro da entidade.
   * Ex.: 'body', 'shadow', 'healthbar', 'effect_burning'
   */
  id: string;

  /**
   * ID da entidade proprietária.
   */
  entityId: string;

  /**
   * Offset em relação à posição da entidade (centro do sprite, não do nó).
   * Permite posicionar nós fora do centro da entidade (ex.: barra de vida acima).
   */
  offset: Vector3 = new Vector3(0, 0, 0);

  /**
   * Ordem de renderização dentro da entidade.
   * Valores menores são desenhados primeiro (atrás). Ex.: shadow=-1, body=0, healthbar=1.
   */
  zIndex: number = 0;

  /**
   * Controla a visibilidade do nó sem removê-lo.
   */
  visible: boolean = true;

  /**
   * Opacidade de 0 (transparente) a 1 (opaco).
   */
  opacity: number = 1;

  /**
   * Fator de escala do nó em relação ao tamanho da entidade.
   */
  scale: Vector3 = new Vector3(1, 1, 1);

  /**
   * Rotação em radianos, aplicada ao redor do eixo Z (2D/top-down).
   */
  rotation: number = 0;

  /**
   * Dados específicos do tipo de nó.
   * O discriminante `type` dentro de `data` determina como o cliente renderiza.
   */
  data: RenderNodeData;

  /**
   * Tags para filtragem semântica no cliente.
   * Ex.: ['ui'], ['effect'], ['debug']
   */
  tags: string[] = [];

  constructor(
    params: Partial<RenderNode> & { id: string; entityId: string; data: RenderNodeData },
  ) {
    Object.assign(this, params);
  }
}
```

---

### `engine-render.types.ts`

Define os tipos de dados específicos de cada tipo de nó. O campo `type` é o discriminante que o cliente usa para escolher o renderer correto.

```typescript
/**
 * Dados de um nó do tipo sprite.
 * O cliente mapeia `texture` para um asset carregado (ex.: Phaser TextureKey).
 */
export type SpriteNodeData = {
  type: 'sprite';
  /** Chave da textura/spritesheet. Ex.: 'player', 'tileset_forest' */
  texture: string;
  /** Frame da spritesheet, se aplicável. Pode ser nome de frame ou índice. */
  frame?: string | number;
  /** Cor de tint em formato 0xRRGGBB. Padrão: sem tint (0xffffff). */
  tint?: number;
  flipX?: boolean;
  flipY?: boolean;
};

/**
 * Dados de um nó do tipo animação.
 * O cliente toca a animação pelo nome.
 */
export type AnimationNodeData = {
  type: 'animation';
  texture: string;
  /** Nome da animação a tocar. Ex.: 'player_walk_down' */
  animation: string;
  /** Se false, o cliente para a animação no frame atual. */
  playing: boolean;
  /** Velocidade da animação. 1 = velocidade padrão. */
  timeScale?: number;
};

/**
 * Dados de um nó do tipo texto.
 * O cliente renderiza texto usando as propriedades fornecidas.
 */
export type TextNodeData = {
  type: 'text';
  content: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  fontFamily?: string;
};

/**
 * Dados de um nó do tipo shape geométrico (debug, efeitos).
 */
export type ShapeNodeData = {
  type: 'shape';
  shape: 'rect' | 'circle';
  width: number;
  height: number;
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  strokeWidth?: number;
};

/**
 * Dados de um nó do tipo barra de progresso (ex.: healthbar, stamina).
 * O cliente interpreta `value` e `max` para desenhar a barra preenchida.
 */
export type ProgressBarNodeData = {
  type: 'progressbar';
  value: number;
  max: number;
  width: number;
  height: number;
  /** Cor da barra preenchida. */
  fillColor?: number;
  /** Cor do fundo (parte vazia). */
  backgroundColor?: number;
};

/**
 * Union discriminada de todos os tipos de nó suportados.
 * Extensível: adicionar um novo tipo aqui e criar o renderer correspondente no cliente.
 */
export type RenderNodeData =
  | SpriteNodeData
  | AnimationNodeData
  | TextNodeData
  | ShapeNodeData
  | ProgressBarNodeData;
```

---

### `engine-render.events.ts`

Seguindo o padrão de `engine-entities.events.ts` e `engine-collisions.events.ts`.

```typescript
/**
 * Emitido quando um RenderNode é adicionado (ou substituído) em uma entidade.
 * Payload: RenderNode
 */
export const ENGINE_RENDER_NODE_ADDED_EVENT = 'engine.render.node.added';

/**
 * Emitido quando um RenderNode é atualizado (visible, data, offset, etc.).
 * Payload: RenderNode
 */
export const ENGINE_RENDER_NODE_UPDATED_EVENT = 'engine.render.node.updated';

/**
 * Emitido quando um RenderNode específico é removido de uma entidade.
 * Payload: { entityId: string; nodeId: string }
 */
export const ENGINE_RENDER_NODE_REMOVED_EVENT = 'engine.render.node.removed';

/**
 * Emitido quando todos os RenderNodes de uma entidade são removidos (tipicamente ao deletar a entidade).
 * Payload: { entityId: string }
 */
export const ENGINE_RENDER_NODES_CLEARED_EVENT = 'engine.render.nodes.cleared';
```

---

### `engine-render-nodes.registry.ts`

Armazenamento puro dos render nodes indexados por entidade. Sem lógica, sem eventos — seguindo o mesmo princípio do `EngineCollidersRegistry`.

```typescript
import { Injectable } from '@nestjs/common';
import { RenderNode } from './render-node';

@Injectable()
export class EngineRenderNodesRegistry {
  private readonly nodes: Map<string, Map<string, RenderNode>> = new Map();

  /**
   * Adiciona ou substitui um render node para uma entidade.
   * Se já existir um nó com o mesmo `id`, ele é sobrescrito.
   */
  add(node: RenderNode): void {
    if (!this.nodes.has(node.entityId)) {
      this.nodes.set(node.entityId, new Map());
    }
    this.nodes.get(node.entityId)!.set(node.id, node);
  }

  /**
   * Remove um render node específico de uma entidade.
   * Se a entidade não tiver mais nós, remove a entrada do mapa pai.
   */
  remove(entityId: string, nodeId: string): void {
    const entityNodes = this.nodes.get(entityId);
    if (!entityNodes) return;
    entityNodes.delete(nodeId);
    if (entityNodes.size === 0) {
      this.nodes.delete(entityId);
    }
  }

  /**
   * Remove todos os render nodes de uma entidade.
   */
  removeAll(entityId: string): void {
    this.nodes.delete(entityId);
  }

  get(entityId: string, nodeId: string): RenderNode | undefined {
    return this.nodes.get(entityId)?.get(nodeId);
  }

  /**
   * Retorna todos os render nodes de uma entidade, ordenados por zIndex.
   */
  getByEntity(entityId: string): RenderNode[] {
    const entityNodes = this.nodes.get(entityId);
    if (!entityNodes) return [];
    return Array.from(entityNodes.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  has(entityId: string, nodeId: string): boolean {
    return this.nodes.get(entityId)?.has(nodeId) ?? false;
  }

  /**
   * Retorna um mapa serializável de todos os nodes: entityId → { nodeId → RenderNode }.
   * Usado pelo EngineRenderState para construir o snapshot inicial.
   */
  getAll(): Map<string, Map<string, RenderNode>> {
    return this.nodes;
  }
}
```

---

### `engine-render-nodes.system.ts`

Orquestra dois comportamentos reativos:

1. **Limpeza automática**: quando uma entidade é deletada, todos os seus render nodes são removidos do registry e patches de deleção são enviados ao store.
2. **Sincronização ao store**: ao receber os eventos de mutação de render node, emite os patches adequados via `EngineStoreManager` para que o socket handler os transmita aos clientes.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENGINE_ENTITY_DELETED_EVENT, Entity } from '../engine-entities';
import { EngineRenderNodesRegistry } from './engine-render-nodes.registry';
import { EngineStoreManager } from '../engine-store';
import { RenderNode } from './render-node';
import {
  ENGINE_RENDER_NODE_ADDED_EVENT,
  ENGINE_RENDER_NODE_REMOVED_EVENT,
  ENGINE_RENDER_NODE_UPDATED_EVENT,
  ENGINE_RENDER_NODES_CLEARED_EVENT,
} from './engine-render.events';

@Injectable()
export class EngineRenderNodesSystem {
  constructor(
    @Inject(EngineRenderNodesRegistry)
    private readonly registry: EngineRenderNodesRegistry,
    @Inject(EngineStoreManager)
    private readonly storeManager: EngineStoreManager,
  ) {}

  // ─── Limpeza ao deletar entidade ─────────────────────────────────────────────

  @OnEvent(ENGINE_ENTITY_DELETED_EVENT)
  onEntityDeleted(entity: Entity): void {
    const nodes = this.registry.getByEntity(entity.id);
    this.registry.removeAll(entity.id);

    // Emite um patch de deleção para cada nó que existia
    for (const node of nodes) {
      this.storeManager.patch({
        type: 'delete',
        key: `renderNodes.${entity.id}.${node.id}`,
      });
    }
  }

  // ─── Sync ao store ────────────────────────────────────────────────────────────

  @OnEvent(ENGINE_RENDER_NODE_ADDED_EVENT)
  onNodeAdded(node: RenderNode): void {
    this.storeManager.patch({
      type: 'set',
      key: `renderNodes.${node.entityId}.${node.id}`,
      value: node,
    });
  }

  @OnEvent(ENGINE_RENDER_NODE_UPDATED_EVENT)
  onNodeUpdated(node: RenderNode): void {
    this.storeManager.patch({
      type: 'set',
      key: `renderNodes.${node.entityId}.${node.id}`,
      value: node,
    });
  }

  @OnEvent(ENGINE_RENDER_NODE_REMOVED_EVENT)
  onNodeRemoved(payload: { entityId: string; nodeId: string }): void {
    this.storeManager.patch({
      type: 'delete',
      key: `renderNodes.${payload.entityId}.${payload.nodeId}`,
    });
  }

  @OnEvent(ENGINE_RENDER_NODES_CLEARED_EVENT)
  onNodesCleared(payload: { entityId: string }): void {
    this.storeManager.patch({
      type: 'delete',
      key: `renderNodes.${payload.entityId}`,
    });
  }
}
```

**Por que usar `EngineStoreManager` diretamente aqui, e não emitir os eventos no SDK?**
O `EngineStoreManager` é o canal canônico para enviar patches ao socket. Se o sync fosse feito no SDK, qualquer código que mutasse o registry diretamente (ex.: um sistema de animação do jogo) não geraria patches. Centralizar o sync no system garante que _qualquer_ mutação que passe pelos eventos do módulo é sincronizada, independente da origem.

---

### `engine-render.state.ts`

Constrói o slice `renderNodes` do snapshot do mundo, para ser incluído na sincronização inicial (`session:init`).

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { EngineRenderNodesRegistry } from './engine-render-nodes.registry';

@Injectable()
export class EngineRenderState {
  constructor(
    @Inject(EngineRenderNodesRegistry)
    private readonly registry: EngineRenderNodesRegistry,
  ) {}

  /**
   * Retorna todos os render nodes como um mapa serializável.
   * Estrutura: { [entityId]: { [nodeId]: RenderNode } }
   */
  getRenderNodesSnapshot(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};

    for (const [entityId, nodesMap] of this.registry.getAll()) {
      result[entityId] = {};
      for (const [nodeId, node] of nodesMap) {
        result[entityId][nodeId] = instanceToPlain(node);
      }
    }

    return result;
  }
}
```

### Integração em `EngineStoreState`

O snapshot existente é estendido para incluir `renderNodes`:

```typescript
// engine-store.state.ts — alteração necessária
import { EngineRenderState } from '../engine-render';

@Injectable()
export class EngineStoreState {
  constructor(
    @Inject(EngineEntitiesManager)
    private readonly engineEntitiesManager: EngineEntitiesManager,
    @Inject(EngineRenderState)                         // ← novo
    private readonly renderState: EngineRenderState,   // ← novo
  ) {}

  getSnapshot() {
    return {
      entities: this.getEntitiesState(),
      renderNodes: this.renderState.getRenderNodesSnapshot(), // ← novo
    };
  }
}
```

> Esta é a **única** alteração nos arquivos existentes. O slice `renderNodes` é transparente para o socket handler — ele simplesmente faz parte do estado sincronizado, como `entities`.

---

### `engine-render.sdk.ts`

Funções imperativas que seguem exatamente o padrão de `engine-collisions.sdk.ts`.

```typescript
import { Container } from '../../../common/container';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngineRenderNodesRegistry } from './engine-render-nodes.registry';
import { RenderNode } from './render-node';
import { RenderNodeData } from './engine-render.types';
import {
  ENGINE_RENDER_NODE_ADDED_EVENT,
  ENGINE_RENDER_NODE_REMOVED_EVENT,
  ENGINE_RENDER_NODE_UPDATED_EVENT,
  ENGINE_RENDER_NODES_CLEARED_EVENT,
} from './engine-render.events';

// ─── Gerenciamento de render nodes ───────────────────────────────────────────

/**
 * Adiciona (ou substitui) um render node em uma entidade.
 * Emite ENGINE_RENDER_NODE_ADDED_EVENT, que o system usa para sincronizar ao store.
 */
export function AddRenderNode(
  params: { id: string; entityId: string; data: RenderNodeData } & Partial<RenderNode>,
): RenderNode {
  const registry = Container.get<EngineRenderNodesRegistry>(EngineRenderNodesRegistry);
  const emitter = Container.get<EventEmitter2>(EventEmitter2);
  const node = new RenderNode(params);
  registry.add(node);
  emitter.emit(ENGINE_RENDER_NODE_ADDED_EVENT, node);
  return node;
}

/**
 * Atualiza propriedades de um render node existente.
 * Operação é no-op silencioso se o nó não existir.
 */
export function UpdateRenderNode(
  entityId: string,
  nodeId: string,
  changes: Partial<Omit<RenderNode, 'id' | 'entityId'>>,
): void {
  const registry = Container.get<EngineRenderNodesRegistry>(EngineRenderNodesRegistry);
  const emitter = Container.get<EventEmitter2>(EventEmitter2);
  const node = registry.get(entityId, nodeId);
  if (!node) return;
  Object.assign(node, changes);
  emitter.emit(ENGINE_RENDER_NODE_UPDATED_EVENT, node);
}

/**
 * Remove um render node específico de uma entidade.
 */
export function RemoveRenderNode(entityId: string, nodeId: string): void {
  const registry = Container.get<EngineRenderNodesRegistry>(EngineRenderNodesRegistry);
  const emitter = Container.get<EventEmitter2>(EventEmitter2);
  registry.remove(entityId, nodeId);
  emitter.emit(ENGINE_RENDER_NODE_REMOVED_EVENT, { entityId, nodeId });
}

/**
 * Remove todos os render nodes de uma entidade.
 */
export function ClearRenderNodes(entityId: string): void {
  const registry = Container.get<EngineRenderNodesRegistry>(EngineRenderNodesRegistry);
  const emitter = Container.get<EventEmitter2>(EventEmitter2);
  registry.removeAll(entityId);
  emitter.emit(ENGINE_RENDER_NODES_CLEARED_EVENT, { entityId });
}

/**
 * Retorna todos os render nodes de uma entidade, ordenados por zIndex.
 */
export function GetRenderNodes(entityId: string): RenderNode[] {
  const registry = Container.get<EngineRenderNodesRegistry>(EngineRenderNodesRegistry);
  return registry.getByEntity(entityId);
}

/**
 * Retorna um render node específico, ou undefined se não existir.
 */
export function GetRenderNode(entityId: string, nodeId: string): RenderNode | undefined {
  const registry = Container.get<EngineRenderNodesRegistry>(EngineRenderNodesRegistry);
  return registry.get(entityId, nodeId);
}

// ─── Atalhos de visibilidade ──────────────────────────────────────────────────

/**
 * Alterna a visibilidade de um render node sem removê-lo.
 */
export function SetRenderNodeVisible(entityId: string, nodeId: string, visible: boolean): void {
  UpdateRenderNode(entityId, nodeId, { visible });
}

/**
 * Altera a opacidade de um render node.
 */
export function SetRenderNodeOpacity(entityId: string, nodeId: string, opacity: number): void {
  UpdateRenderNode(entityId, nodeId, { opacity: Math.max(0, Math.min(1, opacity)) });
}
```

---

### `engine-render.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { EngineRenderNodesRegistry } from './engine-render-nodes.registry';
import { EngineRenderNodesSystem } from './engine-render-nodes.system';
import { EngineRenderState } from './engine-render.state';

@Module({
  providers: [
    EngineRenderNodesRegistry,
    EngineRenderNodesSystem,
    EngineRenderState,
  ],
  exports: [
    EngineRenderNodesRegistry,
    EngineRenderState,
  ],
})
export class EngineRenderModule {}
```

---

### `index.ts`

```typescript
export * from './render-node';
export * from './engine-render-nodes.registry';
export * from './engine-render.events';
export * from './engine-render.module';
export * from './engine-render.sdk';
export * from './engine-render.state';
export * from './engine-render.types';
```

---

### Integração em `engine.module.ts`

```typescript
import { EngineRenderModule } from './engine-render';

@Module({
  imports: [
    EngineEntitiesModule,
    EngineSessionsModule,
    EngineChunksModule,
    EngineStoreModule,
    EngineCollisionsModule,
    EngineRenderModule,   // ← adicionar aqui
    EngineDebugModule,
  ],
  exports: [Engine, EngineStepper],
})
export class EngineModule {}
```

> `EngineRenderModule` exporta `EngineRenderState` para que `EngineStoreModule` possa injetá-lo em `EngineStoreState`.

---

## Fluxo de sincronização

### Conexão inicial de um jogador

```
Cliente conecta via WebSocket
  → SessionsSocketHandler.onConnect
  → session:init { entities: {...}, renderNodes: {...} }
                                      ↑
                          EngineStoreState.getSnapshot()
                          inclui EngineRenderState.getRenderNodesSnapshot()
```

### Adição de um render node em runtime

```
Código do jogo chama: AddRenderNode({ id: 'body', entityId, data: { type: 'sprite', texture: 'player' } })
  → EngineRenderNodesRegistry.add(node)
  → EventEmitter.emit('engine.render.node.added', node)
        │
        ▼
  EngineRenderNodesSystem.onNodeAdded(node)
  → EngineStoreManager.patch({ type: 'set', key: 'renderNodes.{entityId}.body', value: node })
        │
        ▼
  EventEmitter.emit('engine.store.updated', patch)
        │
        ▼
  SessionsSocketHandler.onEngineStoreUpdated(patch)
  → server.emit('session:patch', patch)
        │
        ▼
  Todos os clientes conectados recebem o patch e atualizam seu estado local
```

### Deleção de entidade (cascata automática)

```
EngineEntitiesManager.remove(entityId)
  → EventEmitter.emit('engine.entity.deleted', entity)
        │
        ├─→ EngineStoreSystem.onEngineEntityDeleted(entity)
        │     → patch({ type: 'delete', key: 'entities.{id}' })
        │
        └─→ EngineRenderNodesSystem.onEntityDeleted(entity)
              → for each node: patch({ type: 'delete', key: 'renderNodes.{id}.{nodeId}' })
```

---

## Fluxo de execução por frame

```
ENGINE_STEP_EVENT (EngineStepper)
        │
        ▼
GAME_BEFORE_UPDATE
  └─ EngineSessionSystem: drena fila de actions
GAME_UPDATE
  └─ [MovementSystem, etc.]: aplica velocity → position, emite ENGINE_ENTITY_UPDATED_EVENT
GAME_AFTER_UPDATE
  └─ EngineCollisionsSystem: detecta colisões, emite enter/stay/exit
GAME_BEFORE_RENDER → GAME_RENDER → GAME_AFTER_RENDER
  └─ [reservado para sistemas de animação futuros, ex.: EngineAnimationSystem]
```

> `EngineRenderNodesSystem` **não** se prende ao game loop — ele é puramente reativo a eventos. Sistemas de animação futuros (ex.: um `EngineAnimationSystem` que avança frames sprite a cada tick) se prenderão a `GAME_RENDER_EVENT` e chamarão `UpdateRenderNode()` internamente.

---

## Como usar no código de jogo

### 1. Criar um player com múltiplos nós de renderização

```typescript
// game-players.loader.ts
import { CreateEntity, AddRenderNode } from '../../lib/engine';
import { plainToInstance } from 'class-transformer';
import { Vector3 } from 'three';

export function loadPlayer(playerId: string, name: string) {
  const player = CreateEntity(
    plainToInstance(PlayerEntity, {
      id: playerId,
      position: new Vector3(0, 0, 0),
      size: new Vector3(32, 32, 0),
      tags: ['player', 'collidable'],
    }),
  );

  // Sombra — abaixo do corpo
  AddRenderNode({
    id: 'shadow',
    entityId: player.id,
    zIndex: -1,
    offset: new Vector3(0, 8, 0),
    opacity: 0.4,
    data: { type: 'sprite', texture: 'shadow', tint: 0x000000 },
  });

  // Corpo principal
  AddRenderNode({
    id: 'body',
    entityId: player.id,
    zIndex: 0,
    data: { type: 'animation', texture: 'player', animation: 'player_idle_down', playing: true },
  });

  // Nome do jogador — acima do corpo
  AddRenderNode({
    id: 'nametag',
    entityId: player.id,
    zIndex: 2,
    offset: new Vector3(0, -24, 0),
    data: { type: 'text', content: name, fontSize: 11, color: '#ffffff', align: 'center' },
  });

  // Barra de vida — acima do nome
  AddRenderNode({
    id: 'healthbar',
    entityId: player.id,
    zIndex: 3,
    offset: new Vector3(0, -36, 0),
    data: { type: 'progressbar', value: 100, max: 100, width: 32, height: 4, fillColor: 0x44ff44 },
  });

  return player;
}
```

### 2. Atualizar animação conforme o estado de movimento

```typescript
// game-players.system.ts
@OnEvent('session.action.move')
onMove(session: EngineSession, action: MoveAction): void {
  // ... lógica de movimento ...

  const animation = `player_walk_${entity.facing}`;
  UpdateRenderNode(entity.id, 'body', {
    data: { type: 'animation', texture: 'player', animation, playing: true },
  });
}

onIdle(entityId: string, facing: string): void {
  UpdateRenderNode(entityId, 'body', {
    data: { type: 'animation', texture: 'player', animation: `player_idle_${facing}`, playing: true },
  });
}
```

### 3. Aplicar efeito de queimadura ao receber dano

```typescript
// Sistema de combate
function applyBurnEffect(entityId: string): void {
  AddRenderNode({
    id: 'effect_burn',
    entityId,
    zIndex: 1,
    data: { type: 'animation', texture: 'effects', animation: 'burn_loop', playing: true },
    tags: ['effect'],
  });
}

function removeBurnEffect(entityId: string): void {
  RemoveRenderNode(entityId, 'effect_burn');
}
```

### 4. Atualizar healthbar ao receber dano

```typescript
function updateHealthBar(entityId: string, hp: number, maxHp: number): void {
  UpdateRenderNode(entityId, 'healthbar', {
    data: {
      type: 'progressbar',
      value: hp,
      max: maxHp,
      width: 32,
      height: 4,
      fillColor: hp / maxHp > 0.5 ? 0x44ff44 : hp / maxHp > 0.25 ? 0xffaa00 : 0xff4444,
    },
  });
}
```

### 5. Debug visual — mostrar/ocultar hitboxes

```typescript
// Ativar modo debug visual para todos os players
entities.forEach((entity) => {
  if (!entity.tags.includes('player')) return;

  AddRenderNode({
    id: 'debug_hitbox',
    entityId: entity.id,
    zIndex: 10,
    data: { type: 'shape', shape: 'rect', width: 32, height: 32, stroke: 0xff0000, strokeWidth: 1, fillAlpha: 0 },
    tags: ['debug'],
  });
});

// Desativar modo debug
entities.forEach((entity) => {
  RemoveRenderNode(entity.id, 'debug_hitbox');
});
```

---

## Diagrama de dependências

```
EngineRenderModule
├── providers
│   ├── EngineRenderNodesRegistry    (nodes por entidade: entityId → nodeId → RenderNode)
│   ├── EngineRenderNodesSystem      (limpeza em ENGINE_ENTITY_DELETED + sync ao store)
│   │   ├── injects: EngineRenderNodesRegistry
│   │   └── injects: EngineStoreManager    (via EngineStoreModule, já disponível)
│   └── EngineRenderState            (snapshot para session:init)
│       └── injects: EngineRenderNodesRegistry
└── exports
    ├── EngineRenderNodesRegistry
    └── EngineRenderState

EngineStoreModule (alteração necessária)
└── EngineStoreState
    ├── injects: EngineEntitiesManager  (existente)
    └── injects: EngineRenderState      (novo — via EngineRenderModule)
```

---

## Decisões de design e justificativas

| Decisão | Justificativa |
|---|---|
| **RenderNode separado da `Entity`** | A classe `Entity` não precisa saber sobre visualização; `EngineRenderNodesRegistry` é o dono dos nodes. Segue o mesmo princípio do `Collider`. |
| **Múltiplos nodes por entidade** | Permite composição visual livre: corpo, sombra, UI, efeitos, debug — cada um com zIndex, offset e visibilidade independentes. |
| **Sync via `EngineStoreManager`** | Reutiliza o canal de patches já conectado ao socket handler. Nenhuma nova infra de WebSocket necessária; o cliente recebe render nodes pelo mesmo `session:patch` que já consome. |
| **Sistema reativo, não frame-locked** | `AddRenderNode`/`UpdateRenderNode` sincronizam imediatamente, não no próximo frame. Efeitos temporários não esperam o próximo tick para aparecer no cliente. |
| **`data` como union discriminada** | O campo `type` dentro de `data` permite que o cliente escolha o renderer correto sem switch em `node.type` externo. Extensível sem alterar `RenderNode`. |
| **`zIndex` dentro do node** | Cada node ordena-se explicitamente. Não há dependência de ordem de inserção, o que facilita nodes adicionados em momentos diferentes pelo runtime. |
| **`visible` e `opacity` distintos** | `visible = false` remove o node do pipeline de render completamente (sem custo de GPU). `opacity` permite fade sem remover o node — para transições suaves. |
| **`EngineRenderNodesSystem` faz o cascade de deleção** | Evita vazamento de state no cliente: ao remover a entidade, o cliente também limpa os render nodes correspondentes. Sem isso, nodes órfãos acumulam no estado do cliente. |
| **`EngineRenderState` separado de `EngineStoreState`** | `EngineStoreState` pode injetar `EngineRenderState` sem acoplamento direto com o registry. Se amanhã render nodes migrarem para um serviço de persistência, apenas `EngineRenderState` muda. |
| **`GetRenderNodes` retorna ordenado por zIndex** | O cliente não precisa ordenar; o servidor garante a invariante. |
| **Tags no `RenderNode`** | Permite filtros no cliente (ex.: ocultar todos os nodes com tag `debug` fora do modo dev) sem depender de IDs específicos. |
| **GAME_RENDER_EVENT reservado para animações** | O hook de render no game loop é preservado para um futuro `EngineAnimationSystem` que avance frames de spritesheet por tick, mantendo coerência com o tempo do servidor. |
