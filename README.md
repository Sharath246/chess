# Chess Arena

A browser-based chess app with local two-player games and online matches. The React frontend provides the game board, lobby, authentication screens, and controls. The Go backend handles accounts, sessions, online matchmaking, WebSocket messages, and online game state. Redis stores accounts, sessions, player status, and match data.

## Features

- Register with an email and password, sign in with an email or username, or continue as a guest.
- Play locally on one device or request a match with another connected player.
- Send and respond to online game requests, make moves, offer draws, and resign.
- Online game completion is determined by the backend and sent to both players.

## Requirements

- Go version `1.26.5` or later compatible with `golang/go.mod`.
- Node.js and npm.
- Redis running locally at `localhost:6379` with no password. The Redis address is currently configured in `golang/redis.go`.

## Run Locally

Start Redis before starting the backend. For example, if Docker is installed, run:

```sh
docker run --name chess-redis --publish 6379:6379 --detach redis
```

Start the backend in a terminal:

```sh
cd golang
go run .
```

The HTTP API and WebSocket endpoint listen on port `8080`.

In a second terminal, install and start the frontend:

```sh
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The backend CORS configuration also permits frontend origins on ports `3001` and `3002` for local development.

## Backend API

The base URL is `http://localhost:8080`. Successful authentication responses include a `sessionId`; send it as a bearer token for authenticated HTTP requests.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/register_user` | Register using `{ "email": "...", "password": "..." }`. Passwords must be at least 8 characters. |
| `POST` | `/login` | Sign in using `{ "email": "...", "password": "..." }` or `{ "username": "...", "password": "..." }`. |
| `POST` | `/guest_login` | Create a guest session. No request body is required. |
| `GET` | `/get_online` | Return the usernames with active WebSocket connections. Requires a bearer session token. |
| `POST` | `/post_online` | Mark the authenticated player online. Requires a bearer session token. |
| `GET` | `/play-game` | Open an authenticated game WebSocket. |

Authentication responses contain `username` and `sessionId`; guest responses also contain `isGuest`. Errors are JSON objects with an `error` field. Sessions expire after 24 hours.

## Online Game Protocol

The browser connects to:

```text
ws://localhost:8080/play-game?sessionId=<sessionId>
```

WebSocket messages are JSON objects with a `type` field. Matchmaking uses `READY_FOR_GAME`, `REQUEST_GAME` with an `opponentUsername`, and `ACCEPT_GAME_REQUEST` or `REJECT_GAME_REQUEST`. Moves use `MAKE_MOVE` with a `gameId` and algebraic move notation. The server broadcasts updated FEN positions and `DECLARE_RESULT` messages when a game ends. Draw offers use the backend message type `OFFER DRAW` (including the space); resignation uses `RESIGN_GAME`.

## Useful Commands

Run backend tests:

```sh
cd golang
go test ./...
```

Build the frontend for production:

```sh
cd frontend
npm run build
```

Run frontend tests:

```sh
cd frontend
npm test
```

## Project Layout

```text
frontend/   React application
golang/     Go HTTP and WebSocket backend
```