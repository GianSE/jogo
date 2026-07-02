# Casinha Virtual + Exploração — Fases do Projeto

Roadmap completo do jogo. Cada fase tem seu próprio gate de aprovação antes de implementar.

---

## ✅ Phase 1 — Arquitetura do Sistema

**O que foi decidido:**
- Monorepo com backend Go + frontend React/Phaser
- Clean Architecture: `domain → application → infrastructure`
- WebSocket hub-per-world (sem Redis, in-memory)
- PostgreSQL como fonte da verdade
- Docker Compose (postgres + backend + frontend)
- React overlay + Phaser canvas separados (60 FPS sem re-renders do React no game loop)
- Mobile-first, portrait, touch

**Decisões chave:**
| Decisão | Escolhido | Por quê |
|---|---|---|
| Live state | In-memory Go | 2 jogadores, 1 instância — mais simples |
| Servidor autoritativo | Trust-but-clamp | Jogo cozy, sem combate |
| UI vs jogo | React overlay + Phaser | React fora do loop de 60 FPS |
| Pareamento | Invite code | Sem infraestrutura de email |

---

## ✅ Phase 2 — Database Design

**O que foi criado:**
- Migrations SQL completas (Postgres 16, UUIDs via `gen_random_uuid()`)
- Tabelas: `users`, `worlds`, `world_players`, `player_states`, `items`, `inventory`, `messages`, `gifts`, `houses`, `furniture`, `memories`
- Constraints importantes:
  - `world_players`: slot IN (1,2) — máximo 2 jogadores por mundo
  - `furniture.rotation`: CHECK IN (0, 90, 180, 270)
  - `gifts`: CHECK de consistência picked_up/picked_up_by/picked_up_at
  - `houses.world_id`: UNIQUE — uma casa por mundo
  - `memories`: partial unique index para milestones `first_*`
- Seed de itens: 4 presentes, 6 móveis, 3 recursos
- Migração embarcada com `golang-migrate` + `embed.FS`

---

## ✅ Phase 3 — Backend Skeleton

**O que foi criado:**
- Estrutura de pacotes Go Clean Architecture
- `config/`: leitura de env vars (PORT, DATABASE_URL, JWT_SECRET, APP_ENV)
- `postgres/db.go`: pool pgxpool com MaxConns=10
- `postgres/migrate.go`: golang-migrate via embed
- `/health` (liveness) e `/health/db` (readiness com ping 2s)
- `bootstrap.go`: `EnsureDevSession` — cria usuário+mundo reais no DB, retorna UUIDs para JWT
- `BootstrapService.normalizeInviteCode`: padeia para 4 chars, trunca em 12

---

## ✅ Phase 4 — WebSocket Core

**O que foi criado:**
- `realtime/world.go`: struct `World` com RWMutex, mapa de players + clients, `Register/Unregister/ApplyMove/Broadcast`, clamp de coordenadas (WORLD_WIDTH/HEIGHT=2000)
- `realtime/manager.go`: `Manager` — mapa worldID→*World, `World()` get-or-create, `ScheduleDrop()` com TTL de 30s via `time.AfterFunc`
- `ws/client.go`: goroutinas read/write pump, canal `send` bufferizado, `done` channel, `once.Do` para close seguro
- `ws/handler.go`: upgrade HTTP→WS, verifica JWT, cria Client
- JWT via query param `?token=` (compatível com Safari — não suporta headers no WS)
- `auth/jwt.go`: `Claims{WorldID, Handle, Subject=UserID}`, `Issue` e `Verify`

**Bug corrigido:** `isEmpty` → `IsEmpty` (método exportado chamado incorretamente)

---

## ✅ Phase 5 — Frontend Skeleton

**O que foi criado:**
- Vite + React + TypeScript + Tailwind + Phaser 3
- Tailwind custom theme: `cozy-bg`, `cozy-panel`, `cozy-soft`, `cozy-accent`
- `game/PhaserGame.ts`: `createGame()`, scale RESIZE (portrait-friendly)
- `game/BootScene.ts` → `game/IslandScene.ts`
- `ui/GameCanvas.tsx`: monta Phaser via `useRef`, destroi no unmount
- `ui/Joystick.tsx`: base 128px, knob 56px, pointer capture, MAX=36px
- `ui/ConnectionStatus.tsx`: dot + label + contagem de jogadores
- `ui/JoinPanel.tsx`: campos nome/código, Enter key, loading/error props
- `net/socket.ts`: GameSocket com reconnect exponencial (1s→15s)
- `frontend/.env`: `VITE_API_BASE=http://localhost:8080`

---

## ✅ Phase 6 — Multiplayer Sync

**O que foi criado:**
- Throttle de movimento: 80ms (~12.5/s), dedup por posição
- Interpolação frame-rate-independent: `alpha = 1 - exp(-dt * RATE)` (RATE=10)
- `net/playerBuffer.ts`: Map não-React para posições de alta frequência (sem re-renders)
- `net/bindSocket.ts`: `player_move` → buffer apenas; join/leave → buffer + Zustand
- `store/useGameStore.ts`: status, selfId, worldId, players (presença apenas)
- `localInitialized` flag em IslandScene: snap para posição do servidor no primeiro join/reconnect
- `IslandScene`: jogador local (círculo rosa), remotes com lerp, câmera follow suave

**Decisão chave:** player_move nunca toca o Zustand — Phaser lê diretamente do buffer a cada frame.

---

## ✅ Phase 7 — Chat

**O que foi criado:**
- `application/chat.go`: `MessageStore` port, `ChatService.Send/History`, limite 500 chars, histórico 50 msgs
- `postgres/message_repo.go`: INSERT + ListRecentViews (JOIN users para handle, subquery DESC LIMIT depois re-ordena ASC)
- `ui/ChatPanel.tsx`: toggle 💬, painel 60vh, estilo own/partner, auto-scroll, Enter para enviar
- `store/useChatStore.ts`: messages[], addMessage (cap 200), setHistory
- Histórico entregue via `EventChatHistory` ao conectar (3s timeout)

**Bug corrigido:** `Claims.PlayerID()` → `Claims.UserID()` + campo `Handle` separado no JWT

---

## ✅ Phase 8 — Gifts (Presentes)

**O que foi criado:**
- `application/gifts.go`: `GiftStore` port, `GiftService.Drop/ActiveGifts/Pickup`
- `postgres/gift_repo.go`: `Create` usa SELECT-based INSERT (CTE) para validação atômica de slug+categoria; `MarkPickedUp` inclui `picked_up_by=$2::uuid`
- `ui/GiftPanel.tsx`: botão 🎀, bottom-sheet com 4 opções (flor/carta/concha/bolinho), mensagem opcional, "Pegar presente 🎁" por proximidade
- `net/giftBuffer.ts`: Map não-React para presentes ativos
- `store/useGiftStore.ts`: `nearbyGiftId` (setado pelo Phaser, lido pelo React)
- `IslandScene`: sprites coloridos por slug, detecção de proximidade (raio 80px), `lastNearbyGiftId` para evitar re-renders desnecessários
- Histórico entregue via `EventGiftHistory` ao conectar

**Bugs corrigidos:**
- `gift_history` ausente do union type EventType no TypeScript
- `MarkPickedUp` violava CHECK constraint (picked_up_by IS NULL quando picked_up=true) — corrigido passando `c.userID`
- CORS bloqueava POST localhost:5173→8080 — corrigido com `corsMiddleware()` que reflete o header Origin

---

## ✅ Phase 9 — Casa Compartilhada

**O que foi criado:**

**Backend:**
- `realtime/event.go`: 3 novos eventos — `house_state`, `furniture_place`, `furniture_remove`
- `application/house.go`: `HouseStore` port, `FurnitureView` DTO, `HouseService.Place/Remove/Layout` com validação de bounds do grid (cols 0–9, rows 0–7)
- `postgres/house_repo.go`:
  - `PlaceFurniture`: CTE dupla — primeiro `INSERT INTO houses ON CONFLICT DO UPDATE` (garante que a casa existe), depois `SELECT-based INSERT` para furniture validando slug+categoria atomicamente
  - `RemoveFurniture`: DELETE com USING houses para scoping por worldID
  - `ListFurniture`: LEFT JOIN users (placed_by pode ser NULL)
- `ws/client.go`: handlers para `furniture_place/remove`, `sendHouseState()` ao conectar
- `ws/handler.go` + `main.go`: HouseService injetado na cadeia

**Frontend:**
- `net/events.ts`: `FurnitureItem`, `HouseStatePayload`, `FurnitureRemoveResult`
- `net/furnitureBuffer.ts`: Map não-React (mesmo padrão do giftBuffer)
- `store/useHouseStore.ts`: `inHouse`, `nearHouse`, `selectedCell`, `selectedFurnitureId`
- `net/bindSocket.ts`: handlers para os 3 eventos de casa
- `net/outgoing.ts`: `sendFurniturePlace`, `sendFurnitureRemove`
- `game/HouseScene.ts`: grid 10×8, CELL=48px, câmera zoom-to-fit, tap→seleção de célula/móvel, sync do buffer a cada frame
- `game/IslandScene.ts`: marcador de casa em (300,300), detecção de proximidade (raio 80px) → `nearHouse`, switch para HouseScene quando `inHouse=true`
- `ui/HousePanel.tsx`: "Entrar 🏠" por proximidade, paleta de 6 móveis, painel de remoção, "Sair 🚪"
- `App.tsx`: esconde joystick/chat/gifts quando dentro da casa

**Fluxo completo:**
1. Jogador se aproxima do marcador → botão "Entrar 🏠" aparece
2. Clica → `setInHouse(true)` → IslandScene detecta → `scene.start('House')`
3. HouseScene carrega layout do furnitureBuffer (populado via `house_state` no join)
4. Tap em célula vazia → paleta de móveis → `sendFurniturePlace` → servidor persiste + broadcast → ambos os jogadores veem o móvel aparecer
5. Tap em móvel → painel de remoção → `sendFurnitureRemove` → broadcast
6. Layout persiste após reconexão (DB é fonte da verdade)

---

## 📋 Phase 10 — Sistema de Memórias

**O que será construído:**

Camada emocional do jogo — marcos automáticos que registram momentos especiais do casal no mundo.

**Backend:**
- `application/memory.go`: `MemoryStore` port, `MemoryService.RecordIfFirst(kind, description)`
- `postgres/memory_repo.go`: `CreateIfFirst` usa INSERT com `ON CONFLICT DO NOTHING` na índice parcial `uq_memories_first_kind` — retorna `true` se criou (novo milestone), `false` se já existia
- Gatilhos dentro dos serviços existentes:
  - `gifts.Pickup` → dispara `first_gift` (assíncrono, não bloqueia)
  - `ws/client.serve()` quando 2 jogadores estão online → dispara `first_login_together`
  - Entrar na casa pela 1ª vez → dispara `first_house_entry`
- Novo endpoint WS `EventMemoryCreated` → broadcast para ambos quando um milestone é alcançado
- `EventMemoryHistory` → lista de memórias enviada ao conectar

**Frontend:**
- `store/useMemoryStore.ts`: lista de Memory items
- `net/bindSocket.ts`: handlers para `memory_created` e `memory_history`
- `ui/MemoryPanel.tsx`: painel 📖 timeline vertical com data, ícone e descrição de cada marco
- Sem escrita manual — tudo gerado automaticamente pelo servidor

**Milestones planejados:**
| kind | Quando dispara |
|---|---|
| `first_login_together` | Ambos os jogadores estão online no mesmo mundo pela 1ª vez |
| `first_gift` | Primeiro presente coletado no mundo |
| `first_house_entry` | Primeiro acesso à casa compartilhada |
| `first_resource` | Primeiro recurso coletado (Phase futura) |

**Constraint de unicidade:** A tabela `memories` já tem `CREATE UNIQUE INDEX uq_memories_first_kind ON memories(world_id, kind) WHERE kind LIKE 'first_%'` — garante que milestones `first_*` existam apenas uma vez por mundo, sem locks na aplicação.

---

## 📋 Phase 11 — Polish + PWA

**O que será construído:**

- **PWA:** `vite-plugin-pwa` + service worker + `manifest.json` (ícone, nome, display standalone)
- **Offline shell:** página de loading enquanto o WS reconecta, sem tela em branco
- **Mobile tuning:** testar 60 FPS em Android mid-range, limitar atlas de assets, verificar touch events no iOS Safari
- **UX:** animações suaves nas transições de cena, feedback visual ao colocar móvel, sons opcionais
- **Segurança:** apertar `CheckOrigin` no WebSocket handler, remover endpoint `/api/dev/token` em produção
- **Nginx:** configuração de produção com TLS, proxy reverso, gzip, cache de assets
- **Lighthouse audit:** PWA + Performance + Accessibility

---

## Resumo de Status

| Phase | Título | Status |
|---|---|---|
| 1 | Arquitetura | ✅ Completa |
| 2 | Database Design | ✅ Completa |
| 3 | Backend Skeleton | ✅ Completa |
| 4 | WebSocket Core | ✅ Completa |
| 5 | Frontend Skeleton | ✅ Completa |
| 6 | Multiplayer Sync | ✅ Completa |
| 7 | Chat | ✅ Completa |
| 8 | Gifts | ✅ Completa |
| 9 | Casa Compartilhada | ✅ Completa |
| 10 | Memórias | ✅ Completa |
| 11 | Polish + PWA | ✅ Completa |
