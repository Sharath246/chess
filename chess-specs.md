# Multiplayer Chess (Go) — Portfolio Build Spec

**Goal:** Turn the existing "two players on one screen" chess app into a real-time,
online, multiplayer chess service with a **Go** backend — built to be *demoable* and
*interview-defensible* while keeping the scope realistic for a small portfolio build.

**Why this project:** it makes the "Go" claim on the resume real, reuses the app's
existing chess logic and UI, and gives a clean story around server-authoritative
rules and lifecycle validation.

**Design north star:** a shared backend service that keeps user and game state
consistent across connected clients. In the current implementation, that is expressed
as explicit state-machine validation in Go and the frontend rather than a fully
stateless multi-instance Redis architecture.

**Current status:** The project has moved past the original draft spec in a few
important ways: there is now a Go-side player lifecycle state machine, the frontend
uses the same allowed-state rules, and online games route to a shareable `/gameId`
page after pairing. The app remains incomplete as a distributed multi-instance chess
service: there is no random queue, no reconnect flow, no spectator mode, and no
server-side persistence or cross-instance fan-out yet. Each requirement below is
marked `COMPLETE`, `PARTIAL`, or `INCOMPLETE` based on the code as it exists now.

---

## Tech Stack

| Layer      | Choice                                              | Why |
|------------|-----------------------------------------------------|-----|
| Frontend   | React + chessboard UI                               | Already built; easy to demo |
| Transport  | WebSockets (`gorilla/websocket`)                    | Real-time, bidirectional |
| Backend    | Go (`net/http`)                                     | Server-authoritative game logic |
| Chess rules| Go chess logic (server side)                        | Validates legal moves and turn ownership |
| State      | Redis for session and player lifecycle status        | Tracks online / ready / paired / playing users |
| Persistence| Not yet implemented                                  | No finished-game archive or history |
| Deploy     | Local demo / future hosted deployment               | Not yet deployed |

---

## Functional Requirements

### 1. User & Session
- **1.1 Anonymous quick-play** — a player can start without signing up; server issues a
  session. *Detail: minimal-friction demo flow.* **Status: COMPLETE.** The frontend can
  authenticate a local user session and move into the game menu.
- **1.2 Optional accounts** — username/email login. **Status: COMPLETE.** User sessions
  and authentication are supported by the backend.
- **1.3 Player identity on a board** — each connection is bound to a `playerId` and,
  once in a game, to a `color`/turn owner. **Status: COMPLETE.** Identity and turn are
  enforced server-side; the client never controls the authoritative board state.

### 2. Online Matchmaking / Game Creation
- **2.1 Create game / shareable link** — a player creates a game and gets a join URL.
  *Detail: the current implementation routes online games to a dedicated `/gameId` page.*
  **Status: PARTIAL.** The app does create a route-based game page after pairing, but there
  is no explicit "create invite" flow or join-by-code experience yet.
- **2.2 Random match queue** — "Play online" enters the user into a waiting queue and
  pairs them with the best candidate. **Status: INCOMPLETE.** This is still a manual
  peer-request flow rather than a real queue.
- **2.3 Time controls (optional)** — choose blitz/rapid/no-clock at game creation.
  **Status: INCOMPLETE.** The app uses a fixed online duration and does not expose a
  configurable time control.

### 3. Real-Time Gameplay (WebSockets)
- **3.1 WebSocket connection lifecycle** — connect, authenticate, join a game room,
  receive the current board state on join. **Status: PARTIAL.** Connection and real-time
  game flow work for active matches, but reconnecting to an in-progress game and restoring
  state is not supported.
- **3.2 Move submission** — a player sends a move over the socket; the server decides
  legality. **Status: COMPLETE.** Server-side move validation is active.
- **3.3 Move broadcast** — validated moves are pushed to both players in real time.
  **Status: PARTIAL.** Same-backend live updates work; full multi-instance fan-out and
  spectator delivery are not implemented.
- **3.4 Turn enforcement** — server rejects moves made out of turn or by the wrong
  player. **Status: COMPLETE.** Turn enforcement is enforced at the backend and validated
  in the frontend state machine.

### 4. Chess Rules Engine (Server-Authoritative)
- **4.1 Legal-move validation** — full rules: piece movement, captures, check, and
  illegal move rejection. **Status: COMPLETE.** The rules engine validates legal moves.
- **4.2 Special moves** — castling, en passant, pawn promotion. **Status: COMPLETE.**
  Standard chess edge cases are supported.
- **4.3 Game-end detection** — checkmate, stalemate, draw, resignation. **Status:
  PARTIAL.** End states are detected in gameplay, but timeout logic, draw agreement
  finalization, and complete rematch flow are still pending.

### 5. Clocks & Game Flow
- **5.1 Per-player chess clock** — count down on the mover's time; flag-fall ends the
  game. **Status: INCOMPLETE.** This is not yet authoritative server-side.
- **5.2 Draw offer / resign / rematch** — standard controls with confirm handshake.
  **Status: PARTIAL.** Resignation and draw requests exist, but the flow is not fully
  finalized with a robust server result path or rematch lifecycle.

### 6. Game State & Persistence
- **6.1 Live game state in Redis** — current position, whose turn, players, and match
  metadata. **Status: PARTIAL.** Player status and active match metadata are tracked in
  Redis, but the full game state is not yet fully persisted for reconnect and recovery.
- **6.2 Move history** — full move list per game for replay and PGN export.
  **Status: INCOMPLETE.** There is no durable move history or export flow.
- **6.3 Finished-game archive** — persist completed games + results to Postgres/SQLite.
  **Status: INCOMPLETE.** No archive or history view exists.

### 7. Resilience & Scaling
- **7.1 Reconnection** — if a player drops, they can rejoin the same game and get the
  full current state. **Status: INCOMPLETE.** Rejoin and state restore are not supported.
- **7.2 Redis pub/sub fan-out** — each game is a channel; server instances relay events
  to local sockets. **Status: INCOMPLETE.** This is future work for cross-instance sync.
- **7.3 Stateless, horizontally-scalable instances** — any instance can serve any
  player because no game state lives in process memory. **Status: INCOMPLETE.** The app
  is not yet a multi-instance stateless deployment.
- **7.4 Graceful concurrency** — one goroutine-safe path per game. **Status: INCOMPLETE.**
  The concurrency model has not been stress-tested or hardened.

### 8. Spectating & Post-Game
- **8.1 Spectator mode** — extra viewers subscribe to a game's updates read-only.
  **Status: INCOMPLETE.** Not implemented.
- **8.2 Rating (Elo)** — update player ratings after rated games. **Status: INCOMPLETE.**
  No ratings system exists yet.

---

## Current Implementation Notes

The codebase now contains the following active behaviors that are worth preserving as
project milestones:

- **Backend state validation:** Go enforces a player-status state machine using allowed
  previous states before updating a user's status in Redis.
- **Frontend validation:** the React app mirrors the same transition rules and blocks
  invalid status changes before emitting or processing socket messages.
- **Route-per-game flow:** after a player is paired for an online game, the app moves to
  a dedicated game URL under `/:gameId` so the match can be shared.
- **Scope boundary:** the app does not yet include random queueing, reconnect recovery,
  cross-instance pub/sub, ratings, or a durable archive.

---

## Non-Functional / Quality Bar
- **Server-authoritative everything** — never trust the client for legality, turn, or clock.
  **Status: PARTIAL.** Legal moves and turn ownership are server-authoritative; clock and
  timeout handling remain incomplete.
- **Tests** — unit-test the move validator + game-end detection; a couple of integration
  tests for the WebSocket flow. **Status: INCOMPLETE.** There are no backend test files or
  frontend behavior tests yet.
- **Observability** — structured logs + a `/healthz` endpoint. **Status: INCOMPLETE.**
  Health and operational logging are still missing.
- **Clean README** — architecture diagram, local run instructions, and design decisions.
  **Status: PARTIAL.** The project has a basic README, but the interview-ready polish is
  still missing.
- **Deployment** — provide a working hosted demo. **Status: INCOMPLETE.** No live demo is
  available yet.

---

## Suggested Build Order (current priority list)

1. **M1 — State validation + online flow:** enforce allowed player lifecycle transitions
  and route online games to a shareable page. **Status: COMPLETE.**
2. **M2 — Authoritative rules:** validate legal moves and enforce turn ownership.
  **Status: COMPLETE.**
3. **M3 — Matchmaking / queue:** convert the manual match request flow into a real online
  queue with Redis coordination. **Status: INCOMPLETE.**
4. **M4 — Reconnection + persistence:** restore active games after disconnects and store
  full live state. **Status: INCOMPLETE.**
5. **M5 — Redis pub/sub + multi-instance:** deliver game updates across instance boundaries.
  **Status: INCOMPLETE.**
6. **M6 — Clocks + archive + polish:** add durable history, ratings, a clean demo deck,
  and deployment. **Status: INCOMPLETE.**

---

## Interview Talking Points (rehearse these)
- **"What is working right now?"** → **COMPLETE.** The app already validates player status
  transitions, enforces server-side move legality, and routes online games to a dedicated
  `/:gameId` page.
- **"Why is the state machine important?"** → **COMPLETE.** The backend and frontend both
  enforce the same status lifecycle, which reduces invalid transitions and improves logic
  reliability.
- **"How do you handle scaling and multi-instance sync?"** → **INCOMPLETE.** Cross-instance
  pub/sub, reconnection, and stateless horizontal scaling are still future work.
- **"How do you prevent cheating?"** → **COMPLETE for move legality and turn ownership;
  INCOMPLETE for clocks and timeout resolution.**
- **"What is the next milestone?"** → **Queueing, reconnect recovery, Redis-backed live state,
  and multi-instance synchronization.**

---

## Stretch Ideas (only if you have appetite)
- Bot opponent (integrate a simple engine / Stockfish via UCI). **Status: INCOMPLETE.**
- Move-by-move analysis / eval bar. **Status: INCOMPLETE.**
- Tournament/lobby. **Status: INCOMPLETE.**
- Mobile-friendly UI polish. **Status: INCOMPLETE.**
