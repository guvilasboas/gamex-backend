# GameX Server — Análise Arquitetural Profunda

> Gerado em: Maio 2026  
> Base de código: `apps/server/src`

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Mapa de Camadas](#3-mapa-de-camadas)
4. [Análise por Módulo](#4-análise-por-módulo)
   - 4.1 [App Layer (API + Socket)](#41-app-layer-api--socket)
   - 4.2 [Domain Layer](#42-domain-layer)
   - 4.3 [Database Layer](#43-database-layer)
   - 4.4 [Game Layer](#44-game-layer)
   - 4.5 [Engine Library](#45-engine-library)
   - 4.6 [Redux Library](#46-redux-library)
   - 4.7 [Common](#47-common)
5. [Padrões de Design Identificados](#5-padrões-de-design-identificados)
6. [Fluxo de Dados Completo](#6-fluxo-de-dados-completo)
7. [O que Funciona Bem](#7-o-que-funciona-bem)
8. [Problemas Críticos](#8-problemas-críticos)
9. [Problemas Arquiteturais](#9-problemas-arquiteturais)
10. [Bugs Técnicos](#10-bugs-técnicos)
11. [Melhorias Recomendadas](#11-melhorias-recomendadas)
12. [Scorecard Final](#12-scorecard-final)

---

## 1. Visão Geral

GameX Server é um servidor de jogo multiplayer em tempo real construído sobre NestJS. A proposta central é um **game loop baseado em eventos** que processa estados de entidades, sessões de jogadores e sincroniza o estado do mundo via WebSocket para os clientes conectados.

O projeto é ambicioso: em vez de usar bibliotecas ECS prontas ou soluções de estado convencionais, ele implementa suas próprias abstrações:

- Um **game loop** com stepping customizado
- Um **sistema de chunks** para particionamento espacial
- Um **Redux customizado** inspirado em NGXS com Immer
- Um **sistema de sessões de jogo** com queue de ações
- Um **sistema de entidades** tipo ECS (Entity-Component-System)

A arquitetura resultante é coerente e demonstra bom domínio de engenharia de software, mas acumula algumas decisões que podem comprometer segurança e escalabilidade.

---

## 2. Stack Tecnológica

| Categoria | Tecnologia | Uso |
|---|---|---|
| Framework | NestJS | Base do servidor HTTP + WebSocket |
| Linguagem | TypeScript | Todo o codebase |
| ORM | TypeORM + better-sqlite3 | Persistência relacional |
| WebSocket | Socket.IO | Comunicação em tempo real |
| Auth | JWT (@nestjs/jwt) | Autenticação REST + WS |
| Eventos | EventEmitter2 | Bus de eventos interno |
| CQRS | @nestjs/cqrs | Importado, uso não evidenciado |
| Estado | Custom Redux (Immer + RxJS) | Gerenciamento de estado do jogo |
| Matemática 3D | Three.js (Vector2, Vector3) | Posição, velocidade, tamanho de entidades |
| Serialização | class-transformer | Entity ↔ Plain Object |
| Validação | class-validator | DTOs de entrada |
| Criptografia | bcrypt | Hashing de senhas |
| API Docs | Swagger (@nestjs/swagger) | Documentação REST |
| State Patches | Immer (enablePatches) | Patches granulares para sync |
| Lodash | lodash/set, lodash/isEqual | Utilitários de estado |

---

## 3. Mapa de Camadas

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│             REST (HTTP)          WebSocket (Socket.IO)           │
└────────────────┬─────────────────────────┬───────────────────────┘
                 │                         │
┌────────────────▼──────────── APP ─────────▼───────────────────────┐
│  ApiModule                          SocketModule                  │
│  ├── auth/login        ◄──────────  SessionsSocketGateway        │
│  ├── auth/signup                    SessionsSocketHandler        │
│  ├── auth/session                                                 │
│  └── debug                                                        │
└────────────────┬─────────────────────────┬───────────────────────┘
                 │                         │
┌────────────────▼────── DOMAIN ────────────▼───────────────────────┐
│  AuthModule (AuthService, AuthGuard)                              │
│  UsersModule (UsersService)                                       │
└────────────────┬──────────────────────────────────────────────────┘
                 │
┌────────────────▼─── DATABASE ────────────────────────────────────┐
│  TypeORM (SQLite)  │  User Entity                                 │
└────────────────────┴─────────────────────────────────────────────┘

┌─────────────────────────── GAME ─────────────────────────────────┐
│  GameModule                                                       │
│  ├── GameSessionsModule  (reage a engine.sessions events)        │
│  └── GamePlayersModule   (reage a session.action.* events)       │
└────────────────┬──────────────────────────────────────────────────┘
                 │ events
┌────────────────▼──────────── ENGINE LIB ─────────────────────────┐
│  EngineModule                                                     │
│  ├── EngineStepper  → ENGINE_STEP_EVENT (20 TPS)                 │
│  ├── Engine         → emite game lifecycle events                │
│  ├── EngineEntitiesModule  (Registry + Manager + SDK)            │
│  ├── EngineSessionsModule  (Registry + Manager + System)         │
│  ├── EngineChunksModule    (Registry + Manager + System)         │
│  ├── EngineStoreModule     (Manager + System + State)            │
│  └── EngineDebugModule                                           │
└────────────────┬──────────────────────────────────────────────────┘
                 │
┌────────────────▼─────────── REDUX LIB ───────────────────────────┐
│  ReduxModule (Global)                                             │
│  ├── Store (Immer + BehaviorSubject)                             │
│  ├── ActionResolver                                               │
│  └── Operators (patch, compose, when, ...)                       │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────── COMMON ───────────────────────────────┐
│  Container (service locator)                                      │
│  PasswordService (bcrypt)                                        │
│  Validators (@Match decorator)                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Análise por Módulo

### 4.1 App Layer (API + Socket)

#### API (`src/app/api/`)

Estrutura limpa com separação **Controller → Handler → Service/Domain**. Cada feature tem seu próprio módulo com DTOs específicos.

```
auth/login/    → LoginController, LoginHandler, LoginDto
auth/signup/   → SignupController, SignupHandler, SignupDto
auth/session/  → SessionController (GET /auth/session)
debug/         → DebugController, DebugHandler
```

- Os `Handler`s funcionam como casos de uso (Application Services), recebendo DTOs e orquestrando serviços de domínio. É uma boa separação de responsabilidades.
- Os DTOs usam `class-validator` com limites min/max bem definidos.
- `plainToInstance` é usado consistentemente para serialização das respostas.
- O módulo de `session` verifica o token JWT e retorna os dados básicos do usuário autenticado — útil para o frontend hidrataro estado de auth.

#### Socket (`src/app/socket/`)

A camada WebSocket usa um padrão Gateway + Handler muito idiomático para NestJS:

- `SessionsSocketGateway`: Responsabilidade pura de I/O (recebe eventos, delega ao handler)
- `SessionsSocketHandler`: Toda a lógica de negócio WebSocket

O handler implementa:
- **Autenticação no handshake** via middleware Socket.IO
- **Multi-socket por usuário**: um `Map<userId, Set<socketId>>` para suportar múltiplas tabs/dispositivos
- **Graceful disconnect**: `DISCONNECT_GRACE_MS = 3000ms` permite reconexão sem perder o estado do jogo
- **Sincronização inicial**: `session:init` envia o snapshot completo do estado ao conectar
- **Patch broadcasting**: `@OnEvent(ENGINE_STORE_UPDATED_EVENT)` retransmite patches para todos os clientes

---

### 4.2 Domain Layer

#### AuthModule

- `AuthService`: Encapsula emissão e verificação de JWT — simples e focado.
- `AuthGuard`: Implementa `CanActivate`, extrai Bearer token, verifica com `AuthService` e popula `request.session`.
- `@Auth()` decorator: `createParamDecorator` que extrai `request.session` — elegante e ergonômico para os controllers.

**Problema grave**: O `JwtModule` está registrado com `secret: 'your-secret-key'` hardcoded.

#### UsersModule

- `UsersService`: CRUD de usuários via TypeORM Repository.
- Faz a verificação de unicidade de username antes de criar.
- Delega o hashing de senha ao `PasswordService` — boa separação.

**Problema**: A classe `UsersService` não tem o decorator `@Injectable()`, o que pode causar falhas silenciosas no DI do NestJS dependendo da versão.

---

### 4.3 Database Layer

`DatabaseModule` configura TypeORM com SQLite (`better-sqlite3`), `synchronize: true` e apenas a entidade `User`.

A entidade `User` é minimalista: `id (uuid)`, `name`, `username`, `password`. Sem índices explícitos no `username`.

---

### 4.4 Game Layer

O `GameModule` é a camada de **lógica de jogo**, responsável por traduzir eventos do engine em comportamentos específicos do jogo.

#### GameSessionsModule

`GameSessionsSystem` reage aos eventos de connect/disconnect do engine:
- Na conexão: cria uma entidade `GamePlayer` e registra dados na sessão (`playerId`, `chunkId`)
- Na desconexão: remove a entidade correspondente

Usa o `GamePlayersLoader` para instanciar o player, o que permite futura extensão (carregar dados do banco, por exemplo).

#### GamePlayersModule

`GamePlayersSystem` processa ações de movimento (`move`) vindas da sessão:
- Calcula velocidade baseada na direção (up/down/left/right)
- Gerencia tags `idle`/`walking` no player
- Aplica movimento multiplicado por 5 (velocidade fixa no código)
- Emite `UpdateEntity` para propagar a mudança

---

### 4.5 Engine Library

O coração do projeto. Implementa um loop de jogo com sistema de entidades e sessões.

#### EngineStepper

Game loop baseado em `setTimeout` recursivo:
- Calcula `deltaMs` real entre ticks
- Emite `ENGINE_STEP_EVENT` com `{ tick, deltaMs, timestamp }`
- Padrão `start()/stop()/isRunning()` limpo

#### Engine

Orquestrador do loop:
- `onModuleInit()` inicia o stepper
- `onModuleDestroy()` para o stepper (lifecycle NestJS correto)
- Em cada step: emite a sequência `beforeUpdate → update → afterUpdate → beforeRender → render → afterRender`

Esta sequência de 6 fases é um padrão clássico de game engine (similar a Unity Update/LateUpdate).

#### EngineEntities (Registry + Manager + SDK)

Padrão Registry + Manager bem definido:

- **Registry**: `Map<string, Entity>` puro — armazenamento sem lógica
- **Manager**: CRUD com eventos (`ENGINE_ENTITY_CREATED/UPDATED/DELETED`) e lógica de diff via `isEqual(instanceToPlain(a), instanceToPlain(b))`
- **SDK**: Funções utilitárias (`GetEntity`, `CreateEntity`, `UpdateEntity`, `RemoveEntity`) que acessam o Manager via `Container`

O Manager faz `instanceToPlain → plainToInstance` no `get()`, retornando uma **cópia** da entidade, o que previne mutação acidental do estado interno. É uma decisão deliberada e inteligente.

#### EngineChunks (Registry + Manager + System)

Sistema de **particionamento espacial** com chunks de tamanho fixo (1024x1024):

- Chunks são criados lazily quando uma entidade entra neles
- Chunks são destruídos quando ficam sem sessões associadas
- Cada chunk rastreia os IDs de entidades e sessões que o habitam
- `EngineChunksSystem` reage a `entity.created/deleted/session.updated` para mover entidades entre chunks automaticamente

O design é eficiente: chunks existem apenas enquanto há jogadores observando aquela região.

#### EngineSessions (Registry + Manager + System)

Sistema de sessões com uma arquitetura elegante:

- Cada sessão tem um **array de actions** que funciona como uma fila
- `pushAction()` adiciona à fila; o `EngineSessionSystem` drena a fila no evento `GAME_BEFORE_UPDATE_EVENT`
- Para cada action, emite `session.action.{type}` — os systems do jogo escutam esses eventos específicos
- O sistema garante que as ações são processadas de forma determinística, sempre antes do update frame

O `set(sessionId, key, value)` usa `lodash/set` para escrita em path com dot-notation, mas a sessão é mutada diretamente (sem imutabilidade).

#### EngineStore (Manager + System + State)

Responsável por manter e sincronizar o estado do mundo com os clientes:

- `EngineStoreState`: Constrói um snapshot completo do mundo (`{ entities: {...} }`)
- `EngineStoreSystem`: Escuta eventos de entidade e emite patches via `EngineStoreManager`
- `EngineStoreManager`: Apenas emite o evento `ENGINE_STORE_UPDATED_EVENT` com o patch — é um relay

O `SessionsSocketHandler` escuta `ENGINE_STORE_UPDATED_EVENT` e faz `server.emit('session:patch', patch)` — broadcasting global de todos os patches para todos os clientes.

---

### 4.6 Redux Library

Uma das partes mais sofisticadas do projeto: uma **reimplementação de NGXS** adaptada para NestJS.

#### Estrutura

```
@State({ name: 'players', defaults: [] })
class PlayersState {
  @Action(AddPlayerAction)
  addPlayer(ctx: StateContext<Player[]>, action: AddPlayerAction) {
    ctx.setState(patch({ ... }));
  }
}
```

#### Componentes

- **`@State()`**: Decorator que registra metadata com Reflect. Aplica `@Injectable()` automaticamente.
- **`@Action()`**: Decorator de método que mapeia tipo de ação ao handler.
- **`ActionResolver`**: Mantém um `Map<actionType, ActionHandler[]>` para dispatch em O(1).
- **`Store`**: Despacha ações, cria `StateContext` por slice, usa Immer para patches, batcheia patches durante dispatch aninhado.
- **`ReduxStateContext`**: Implementa `getState/setState/patchState` com `reconcileDraft` para patches granulares.
- **Operators**: `patch`, `compose`, `when`, `insertItem`, `removeItem`, etc. — NGXS-compatible.

#### Pontos de destaque

- **Patch batching**: Múltiplos handlers em um dispatch são agrupados em um único evento de mudança.
- **`reconcileDraft`**: Função customizada que faz diff recursivo no draft do Immer, gerando patches mais granulares em vez de substituição completa do slice.
- **Compatibilidade NGXS**: Handlers podem retornar o próximo estado diretamente (estilo NGXS legado).
- **`structuredClone`** nos snapshots para isolamento de mutação externa.

---

### 4.7 Common

#### Container

Service locator que envolve a instância NestJS para acesso estático ao DI container:

```typescript
Container.set(app);         // chamado em main.ts
Container.get<T>(token);    // usado nos SDKs
```

Embora funcional, é um anti-pattern (ver seção de problemas).

#### PasswordService

Wrapper limpo sobre `bcrypt` com 10 salt rounds.

#### @Match Validator

Decorator customizado do `class-validator` para confirmar que dois campos são iguais (útil para `passwordConfirmation`). Implementação correta e reutilizável.

---

## 5. Padrões de Design Identificados

### 5.1 Event-Driven Architecture (EDA)

O projeto usa eventos como principal mecanismo de comunicação entre módulos. Isso cria **baixo acoplamento**: o `EngineChunksSystem` não sabe nada sobre `EngineEntitiesManager` diretamente — ele apenas reage ao evento `engine.entity.created`.

### 5.2 ECS-Like (Entity-Component-System)

Embora não seja um ECS puro (não há componentes separáveis), a arquitetura imita o padrão:
- **Entities**: objetos de dados com posição, velocidade, tags
- **Systems**: classes que processam eventos sobre entidades (GamePlayersSystem, EngineChunksSystem)
- **Registries**: armazenamento indexado das entidades

### 5.3 Registry + Manager + System

Triângulo recorrente em todo o engine:
- **Registry**: armazenamento puro (`Map`)
- **Manager**: operações de alto nível com side effects (eventos)
- **System**: lógica reativa que escuta eventos e coordena managers

### 5.4 Controller → Handler → Service

Na camada de API:
- **Controller**: HTTP I/O, decorators Swagger
- **Handler**: caso de uso (orquestração)
- **Service/Domain**: lógica de negócio reutilizável

### 5.5 Action Queue Processing

Ações de clientes são enfileiradas por sessão e processadas de forma **determinística** no início de cada frame (`GAME_BEFORE_UPDATE_EVENT`). Isso evita race conditions e garante que o estado do mundo é consistente durante o frame de update.

### 5.6 SDK Functions (Service Locator)

Funções globais como `GetEntity()`, `CreateEntity()`, `SetSessionData()` encapsulam o acesso ao DI container. Permitem uso funcional do DI sem injeção explícita — conveniente porém problemático (ver seção de problemas).

---

## 6. Fluxo de Dados Completo

### Fluxo de Conexão de um Jogador

```
Cliente conecta via WS
  → SessionsSocketGateway.afterInit (middleware de auth)
    → AuthService.verifyToken(token)
    → client.data.session = { id, username }
  → SessionsSocketGateway.handleConnection
    → SessionsSocketHandler.onSocketConnect
      → Cancela disconnect timer pendente (reconexão)
      → activeConnections.get(userId).add(socketId)
      → sessionsManager.connect(session)
        → EngineSessionsRegistry.add(session)
        → EventEmitter.emit('engine_sessions_connect', sessionId)
          → GameSessionsSystem.onSessionConnect
            → GamePlayersLoader.loadPlayerEntity(sessionId)
            → CreateEntity(player)
              → EngineEntitiesManager.create(player)
                → EngineEntitiesRegistry.add(player)
                → EventEmitter.emit('engine.entity.created', player)
                  → EngineChunksSystem.onEntityCreated
                    → EngineChunksManager.loadChunkByEntity(player)
                  → EngineStoreSystem (não escuta created, apenas updated/deleted)
            → SetSessionData(sessionId, 'playerId', player.id)
            → SetSessionData(sessionId, 'chunkId', player.chunkId)
      → client.emit('session:init', EngineStoreState.getSnapshot())
```

### Fluxo de Ação de Movimento (por frame)

```
Cliente envia socket: 'session:action' { type: 'move', up: true }
  → SessionsSocketHandler.onSessionAction
    → sessionsManager.pushAction(sessionId, action)
      → session.actions.push(action)

EngineStepper.step() (20 TPS)
  → EventEmitter.emit('engine.step')
    → Engine.onStep()
      → EventEmitter.emit('game.preUpdate')
        → EngineSessionSystem.onGameBeforeUpdate()
          → Para cada sessão:
            → session.actions.shift() → action { type: 'move', ... }
            → EventEmitter.emit('session.action.move', { sessionId, action })
              → GamePlayersSystem.onMoveAction
                → GetEntity(sessionId) → player
                → player.move(velocity * 5)
                → UpdateEntity(player)
                  → EngineEntitiesManager.update(player)
                    → isEqual check (anterior vs novo)
                    → EventEmitter.emit('engine.entity.updated', prev, player)
                      → EngineChunksSystem.onEntityUpdated (verifica chunk change)
                      → EngineStoreSystem.onEngineEntityUpdated
                        → EngineStoreManager.patch({ type: 'set', key: 'entities.{id}', value: player })
                          → EventEmitter.emit('engine-store-updated', patch)
                            → SessionsSocketHandler.onStoreUpdate
                              → server.emit('session:patch', patch)
                                → TODOS os clientes recebem o patch
      → EventEmitter.emit('game.update')
      → EventEmitter.emit('game.postUpdate')
      → EventEmitter.emit('game.preRender')
      → EventEmitter.emit('game.render')
      → EventEmitter.emit('game.postRender')
```

---

## 7. O que Funciona Bem

### ✅ Separação de Responsabilidades Clara

Cada módulo tem uma fronteira bem definida. `EngineEntitiesRegistry` só armazena, `EngineEntitiesManager` só opera, `EngineEntitiesSDK` só expõe. Isso facilita testes unitários e substituição de implementações.

### ✅ Sistema de Chunks Elegante

A criação/destruição lazy de chunks baseada na presença de sessões é inteligente. Chunks sobrevivem apenas enquanto há jogadores observando aquela região, economizando memória automaticamente. A propagação de mudança de chunk ao atualizar uma entidade via `EngineChunksSystem` é limpa e reativa.

### ✅ Reconexão Graceful

O `DISCONNECT_GRACE_MS` de 3 segundos no `SessionsSocketHandler` é uma feature real de qualidade de produto. Evita que uma simples oscilação de rede destrua o estado de sessão do jogador. A combinação com `activeConnections` (multi-socket) suporta múltiplas abas sem conflito.

### ✅ Redux com Immer e Patch Batching

A implementação de Redux é sofisticada. O `reconcileDraft` garante patches Immer granulares em vez de substituição total do slice. O batching de patches durante dispatch previne eventos múltiplos quando um dispatch desencadeia handlers em múltiplos states. O `BehaviorSubject` permite consumo reativo do estado.

### ✅ Action Queue Determinística

O modelo de buffering de actions por sessão (processadas no `GAME_BEFORE_UPDATE`) é correto do ponto de vista de game design. Garante que o update do frame começa com todas as intenções do frame anterior já conhecidas, sem interrupções mid-frame.

### ✅ Cópia Defensiva no Manager de Entidades

O `EngineEntitiesManager.get()` retorna `plainToInstance(constructor, instanceToPlain(entity))` — uma cópia profunda. Código externo que manipula a entidade retornada não corrompe o estado interno do registry.

### ✅ DTOs com Validação Robusta

`LoginRequestDto` e `SignupRequestDto` têm `@IsNotEmpty`, `@MinLength`, `@MaxLength`. O `@Match` customizado para `passwordConfirmation` é uma adição útil. O `GlobalValidationPipe` em `main.ts` garante que todos os endpoints são cobertos.

### ✅ Swagger Integrado

Documentação OpenAPI com `operationId` definido nos endpoints — facilita geração de clientes TypeScript tipados no frontend.

### ✅ Lifecycle Hooks do NestJS

`Engine` usa `OnModuleInit/OnModuleDestroy` corretamente para iniciar e parar o game loop. Isso garante comportamento correto em shutdown graceful.

### ✅ `isEqual` antes de Emitir Eventos de Update

O `EngineEntitiesManager.update()` compara o estado anterior com o novo antes de emitir `ENGINE_ENTITY_UPDATED_EVENT`. Isso evita propagação desnecessária de eventos quando o estado não mudou.

### ✅ Separação Gateway / Handler no WebSocket

O Gateway lida apenas com I/O de Socket.IO, delegando 100% da lógica ao Handler injetável. Isso torna o Handler testável unitariamente sem depender do Socket.IO.

---

## 8. Problemas Críticos

### 🚨 JWT Secret Hardcoded

**Arquivo**: `src/domain/auth/auth.module.ts`

```typescript
JwtModule.register({
  secret: 'your-secret-key', // ← CRÍTICO
})
```

O secret do JWT está hardcoded com o valor padrão de template. Qualquer pessoa pode forjar tokens. Deve ser lido de variável de ambiente com validação obrigatória:

```typescript
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow('JWT_SECRET'),
    signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
  }),
})
```

### 🚨 SQLite com `synchronize: true` em Produção

**Arquivo**: `src/database/database.module.ts`

`synchronize: true` faz o TypeORM alterar o schema automaticamente na inicialização. Em produção isso pode causar perda de dados. Deve ser desabilitado e substituído por migrations. Além disso, o caminho `database.sqlite` é relativo e hardcoded.

```typescript
// Correto para produção:
synchronize: process.env.NODE_ENV !== 'production',
database: process.env.DB_PATH ?? 'database.sqlite',
```

### 🚨 Endpoint de Debug sem Autenticação

**Arquivo**: `src/app/api/debug/debug.controller.ts`

O endpoint `GET /debug` expõe todas as sessões ativas, entidades e chunks do engine — informação sensível de todos os jogadores online — sem nenhuma autenticação.

### 🚨 CORS `origin: true`

**Arquivo**: `src/main.ts`

```typescript
app.enableCors({ origin: true, credentials: true });
```

`origin: true` espelha o header `Origin` de qualquer requisição, efetivamente aceitando qualquer origem. Deve ser configurado com a lista de origens permitidas via variável de ambiente.

---

## 9. Problemas Arquiteturais

### ⚠️ Container (Service Locator) — Anti-Pattern de DI

**Arquivo**: `src/common/container/container.ts`  
**Usado em**: `engine-entities.sdk.ts`, `engine-sessions.sdk.ts`

```typescript
export class Container {
  static app: INestApplication;
  static get<T>(token): T { return this.app.get(token); }
}
```

O `Container` é um service locator global. Problemas:
1. Cria dependência implícita na instância do app NestJS
2. Torna os SDKs impossíveis de testar unitariamente (mock requer setar o container global)
3. A chamada `Container.get()` falha silenciosamente se o container não foi inicializado
4. Cria acoplamento temporal: os SDKs só funcionam após `bootstrap()` ter rodado

**Solução**: Injetar os Managers diretamente onde necessário, ou usar `ModuleRef` para resolução dinâmica quando injeção direta não é possível.

### ⚠️ Dois Sistemas de Estado Paralelos

O projeto tem **dois mecanismos de estado** independentes:
1. `lib/redux` — Redux customizado com `@State/@Action`, Immer, BehaviorSubject
2. `lib/engine/engine-store` — `EngineStoreState/EngineStoreManager` com patches manuais

O Redux é usado para estado de aplicação (se houver states registrados), enquanto o engine-store é o canal de sync com clientes. Eles não se comunicam. Não fica claro quem é o "source of truth" do estado do jogo. A entidade existe no `EngineEntitiesRegistry` (in-memory), não em um Redux slice.

### ⚠️ Broadcasting Global de Patches (sem filtro por chunk)

**Arquivo**: `src/app/socket/sessions/sessions-socket.handler.ts`

```typescript
@OnEvent(ENGINE_STORE_UPDATED_EVENT)
onStoreUpdate(patch: EngineStorePatch) {
  this.server.emit('session:patch', patch); // → TODOS os clientes
}
```

Todo patch de qualquer entidade é enviado para **todos** os clientes conectados. Em um jogo com muitos jogadores, um cliente recebe updates de entidades que estão do outro lado do mapa e jamais serão renderizadas. O sistema de chunks existe exatamente para resolver isso, mas não está sendo usado no broadcasting.

**Solução**: Usar as `sessions` de cada `Chunk` para enviar patches apenas para os jogadores que habitam o chunk da entidade alterada:

```typescript
const chunkId = entity.chunkId;
const chunk = chunksRegistry.get(chunkId);
for (const sessionId of chunk.sessions) {
  const sockets = activeConnections.get(sessionId);
  sockets?.forEach(sid => this.server.to(sid).emit('session:patch', patch));
}
```

### ⚠️ `UsersService` sem `@Injectable()`

**Arquivo**: `src/domain/users/users.service.ts`

A classe não tem o decorator `@Injectable()`. Funciona atualmente por causa de como o módulo é configurado, mas é frágil e viola a convenção NestJS.

### ⚠️ Nenhum Teste Automatizado

Há um único arquivo `password.service.spec.ts` e um `app.e2e-spec.ts` vazio. Um projeto com essa complexidade (game loop, ECS, Redux customizado, WebSocket) deveria ter cobertura de testes unitários nos módulos críticos do engine.

### ⚠️ `CqrsModule` Importado sem Uso Aparente

`AppModule` importa `CqrsModule.forRoot()`, mas não há `CommandBus`, `QueryBus`, `CommandHandler` ou `QueryHandler` no código. A arquitetura usa EventEmitter2 e Redux próprios. O módulo pode ser removido ou é um placeholder para expansão futura (não documentado).

### ⚠️ `Shape` — Classe Vazia

**Arquivo**: `src/lib/geometry/shape.ts`

```typescript
export class Shape {}
```

Placeholder sem implementação. Indica geometria planejada mas não implementada.

---

## 10. Bugs Técnicos

### 🐛 `getById` não Implementado no EngineSessionsManager

**Arquivo**: `src/lib/engine/engine-sessions/engine-sessions.manager.ts`

```typescript
getById(sessionId: string | undefined) {
  throw new Error('Method not implemented.');
}
```

Método público que lança erro. Se chamado em produção, quebra o servidor. Deve ser implementado (o método `get()` logo abaixo já faz o mesmo) ou removido.

### 🐛 `EngineStoreSystem` — Handlers com Lógica Duplicada

**Arquivo**: `src/lib/engine/engine-store/engine-store.system.ts`

```typescript
@OnEvent(ENGINE_ENTITY_UPDATED_EVENT)
onEngineEntityCreated(entity: Entity) { ... }  // ← nome errado + evento errado

@OnEvent(ENGINE_ENTITY_UPDATED_EVENT)           // ← mesmo evento!
onEngineEntityUpdated(_: Entity, entity: Entity) { ... }
```

O método `onEngineEntityCreated` escuta `ENGINE_ENTITY_UPDATED_EVENT` (deveria ser `CREATED`), tem assinatura incompatível (recebe 1 argumento mas o evento `UPDATED` passa 2), e faz exatamente o mesmo que `onEngineEntityUpdated`. Na prática, quando uma entidade é atualizada, dois patches idênticos são enviados por frame.

Adicionalmente, a entidade criada nunca dispara um patch para os clientes (o evento `ENGINE_ENTITY_CREATED_EVENT` não é escutado aqui), portanto um player recém-conectado que move pela primeira vez "aparece" para os outros clientes apenas no update, não na criação.

### 🐛 Inconsistência de TPS no EngineStepper

**Arquivo**: `src/lib/engine/engine-stepper.ts`

```typescript
private tickMs = 1000 / 20;  // campo inicial: 20 TPS

start(tickMs = 1000 / 60): void {  // parâmetro padrão: 60 TPS
  this.tickMs = tickMs;
  ...
}
```

E em `engine.ts`:
```typescript
onModuleInit(): void {
  this.stepper.start(); // usa o padrão de 60 TPS — ignora o campo 20 TPS
}
```

O comentário do campo diz 20 TPS, mas na prática o servidor roda a 60 TPS. É uma inconsistência que pode confundir quem lê o código.

### 🐛 `Engine.onStep` ignora o `EngineStepEvent`

**Arquivo**: `src/lib/engine/engine.ts`

```typescript
@OnEvent(ENGINE_STEP_EVENT)
onStep() {  // ← não recebe o evento
  this.eventEmitter.emit(GAME_BEFORE_UPDATE_EVENT);
  ...
}
```

O `EngineStepper` emite `{ tick, deltaMs, timestamp }`, mas o `Engine` não captura esses dados e não os repassa para os eventos de game loop. Nenhum system tem acesso ao `deltaMs` para fazer física frame-independent. Movimentos e físicas são frame-dependent e variam com oscilações de tick rate.

### 🐛 Typo: `DispatchedSessionAction`

**Arquivo**: `src/lib/engine/engine-sessions/engine-session.types.ts`

```typescript
export type DispatchedSessionAction<T>  // ← faltou o 'at' em Dispatched
```

Typo propagado em `game-players.actions.ts` e potencialmente em outros lugares.

### 🐛 Typo: `debug.hander.ts`

**Arquivo**: `src/app/api/debug/debug.hander.ts`

Nome do arquivo com typo (`hander` → `handler`). Não afeta runtime mas é inconsistente com o resto do projeto.

### 🐛 `UsersService.createUser` — Validação Inconsistente

```typescript
async createUser(data: Partial<User>): Promise<User> {
  if (!data.username || !data.password) {
    throw new Error('Username and password are required');
  }
  // ...
  const hashedPassword = await this.passwordService.hashPassword(password ?? '');
  //                                                               ^^^^^^^^^ redundante
}
```

O `?? ''` é dead code — `password` já foi verificado no guard acima. Indica um refactor incompleto.

### 🐛 `User` sem índice único em `username`

**Arquivo**: `src/database/entities/user.entity.ts`

```typescript
@Column()
username: string; // ← sem @Unique()
```

O `UsersService.createUser` verifica unicidade via query (`findByUsername`), mas sem índice único no banco, há uma race condition em criações concorrentes (TOCTOU — Time-of-Check-Time-of-Use). Deve ter `@Column({ unique: true })`.

---

## 11. Melhorias Recomendadas

### 11.1 Segurança (Urgente)

```typescript
// 1. JWT via variável de ambiente com validação
// 2. Proteção do endpoint /debug com AuthGuard
// 3. Rate limiting no login/signup (throttler do NestJS)
// 4. CORS configurável via env
// 5. @Unique() em username
// 6. Migrar de synchronize: true para migrations
```

### 11.2 Eliminar o Container Service Locator

Substituir o `Container` pelos SDKs por injeção tradicional. Onde for necessário uso fora do contexto DI, usar `ModuleRef`:

```typescript
// Em vez de:
Container.get<EngineEntitiesManager>(EngineEntitiesManager)

// Usar injeção normal ou ModuleRef:
@Inject(EngineEntitiesManager) private readonly entityManager: EngineEntitiesManager
```

### 11.3 Patch Broadcasting por Chunk

```typescript
// SessionsSocketHandler
@OnEvent(ENGINE_STORE_UPDATED_EVENT)
onStoreUpdate(patch: EngineStorePatch) {
  const entityId = patch.key.split('.')[1];
  const chunk = this.chunksRegistry.get(this.entitiesRegistry.get(entityId)?.chunkId);

  if (!chunk) {
    this.server.emit('session:patch', patch); // fallback: broadcast global
    return;
  }

  for (const sessionId of chunk.sessions) {
    for (const socketId of this.activeConnections.get(sessionId) ?? []) {
      this.server.to(socketId).emit('session:patch', patch);
    }
  }
}
```

### 11.4 Propagar `deltaMs` no Game Loop

```typescript
// Engine.ts
@OnEvent(ENGINE_STEP_EVENT)
onStep(event: EngineStepEvent) {  // receber o evento
  this.eventEmitter.emit(GAME_BEFORE_UPDATE_EVENT, event);
  this.eventEmitter.emit(GAME_UPDATE_EVENT, event);
  // ...
}

// GamePlayersSystem.ts
@OnEvent(createActionEvent('move'))
onMoveAction(action: MoveAction, event: EngineStepEvent) {
  const speed = 5 * (event.deltaMs / 1000); // física frame-independent
  player.move(velocity.multiplyScalar(speed));
}
```

### 11.5 Testes Unitários Prioritários

Módulos que mais se beneficiam de testes:
- `EngineEntitiesManager` (lógica de diff + eventos)
- `EngineChunksSystem` (lógica de chunk transition)
- `EngineSessionSystem` (processamento de action queue)
- `Store` do Redux (dispatch, patches, state isolation)
- `SessionsSocketHandler` (reconexão, multi-socket)

### 11.6 Variáveis de Ambiente com Validação (Joi/Zod)

```typescript
// config/validation.schema.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  DB_PATH: Joi.string().default('database.sqlite'),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
});
```

### 11.7 Corrigir `EngineStoreSystem`

```typescript
// Remover onEngineEntityCreated duplicado
// Corrigir para escutar o evento correto:

@OnEvent(ENGINE_ENTITY_CREATED_EVENT)
onEntityCreated(entity: Entity) {
  this.engineStoreManager.patch({ type: 'set', key: `entities.${entity.id}`, value: entity });
}

@OnEvent(ENGINE_ENTITY_UPDATED_EVENT)
onEntityUpdated(_prev: Entity, entity: Entity) {
  this.engineStoreManager.patch({ type: 'set', key: `entities.${entity.id}`, value: entity });
}

@OnEvent(ENGINE_ENTITY_DELETED_EVENT)
onEntityDeleted(entity: Entity) {
  this.engineStoreManager.patch({ type: 'delete', key: `entities.${entity.id}` });
}
```

### 11.8 Padronizar Nomenclatura de Eventos

Usar snake_case ou dot.notation de forma consistente:

```typescript
// Inconsistente hoje:
'engine.entity.created'      // dot notation
'engine_sessions_connect'    // underscore
'engine-store-updated'       // dash

// Padronizado:
'engine.entity.created'
'engine.sessions.connect'
'engine.store.updated'
```

### 11.9 Implementar ou Remover `Shape`

A classe `Shape` em `src/lib/geometry/shape.ts` está vazia. Definir ou remover. Para um jogo 2D/2.5D, poderia conter lógica de AABB (Axis-Aligned Bounding Box) ou hitbox que o sistema de chunks poderia usar para colisão.

---

## 12. Scorecard Final

| Dimensão | Nota | Comentário |
|---|---|---|
| **Arquitetura Geral** | 8/10 | Camadas bem definidas, separação clara de responsabilidades |
| **Design de Módulos** | 8/10 | Registry/Manager/System é um padrão coerente e extensível |
| **Game Engine** | 7/10 | Loop funcional, chunks elegantes; deltaMs ignorado compromete física |
| **Redux Customizado** | 9/10 | Implementação sofisticada com Immer, patches, batching, operadores NGXS |
| **Segurança** | 3/10 | JWT hardcoded, debug sem auth, CORS aberto, sem rate limiting |
| **Escalabilidade** | 5/10 | Broadcasting global sem filtro por chunk é um bottleneck real |
| **Qualidade de Código** | 7/10 | Bem documentado, mas com bugs e inconsistências notáveis |
| **Testes** | 2/10 | Praticamente inexistentes para a complexidade do projeto |
| **DX / Ergonomia** | 7/10 | SDKs funcionais, decorators expressivos, mas Container é um anti-pattern |
| **Consistência** | 6/10 | Typos, eventos com naming misto, dois sistemas de estado |

**Média: 6.2/10**

O projeto tem uma base arquitetural sólida e criativa — especialmente o engine customizado e o Redux. Os problemas mais críticos são de segurança (JWT hardcoded) e escalabilidade (broadcasting global). Com as correções apontadas nas seções 8, 9 e 10, o projeto chega facilmente a 8+/10.
