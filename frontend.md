apps/client/src/
├── main.tsx
├── app.tsx
│
├── atoms/                        # Estado global com Jotai
│   ├── players.atom.ts           # atomWithImmer para o array de players
│   ├── connection.atom.ts        # status da conexão (connected, reconnecting…)
│   └── patches.ts                # aplica Immer patches recebidos no átomo
│
├── socket/                       # Camada de comunicação
│   ├── socket.client.ts          # Instância do socket.io-client
│   ├── socket.provider.tsx       # Provider que inicializa a conexão
│   ├── use-store-sync.ts         # Hook: escuta store:state e store:patch
│   └── use-player-input.ts       # Hook: envia eventos move-player
│
├── game/                         # Lógica e rendering do jogo
│   ├── game.tsx                  # Stage do Konva (tamanho, providers)
│   ├── game-layer.tsx            # Layer principal
│   ├── entities/
│   │   ├── player.tsx            # Konva Group com sprite/shape do player
│   │   └── players-layer.tsx     # Renderiza todos os players do átomo
│   └── hooks/
│       ├── use-game-loop.ts      # requestAnimationFrame loop (interpolação)
│       └── use-keyboard.ts       # Captura teclas WASD/arrows
│
├── ui/                           # HUD, menus, overlays (HTML/CSS, fora do canvas)
│   ├── hud.tsx
│   └── connection-status.tsx
│
└── assets/
    └── sprites/
