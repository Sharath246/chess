package main

import (
	"context"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/notnil/chess"
)

var active_games map[string]*chess.Game
var activeGamesMutex sync.RWMutex

// processMessage takes a context, sender connection and username, and a decoded protocol
// message. It dispatches the corresponding matchmaking or game action and returns a response
// message, or nil when the action has already broadcast its result.
func processMessage(ctx context.Context, conn *websocket.Conn, username string, msg any) any {
	switch message := msg.(type) {
	case PlayerMessage:
		message.Username = username
		switch message.TYPE {
		case READY_FOR_GAME:
			return make_conn_ready_for_game(message)
		case REQUEST_GAME:
			return request_game(ctx, message)
		case ACCEPT_GAME_REQUEST:
			response := accept_game(ctx, conn, message)
			if response.TYPE == PAIRED {
				start_game(ctx, message.Username, message.OpponentUsername)
			}
			return response
		case REJECT_GAME_REQUEST:
			return decline_game(ctx, message)
		default:
			return PlayerMessage{Username: message.Username, TYPE: REJECT}
		}
	case GameReceiveMessage:
		message.Username = username
		switch message.TYPE {
		case MAKE_MOVE:
			return make_game_move(ctx, message)
		case OFFER_DRAW:
			return offer_draw(ctx, message)
		case RESIGN_GAME:
			return resign_game(ctx, message)
		case ACCEPT_DRAW_REQUEST:
			return accept_draw(ctx, message)
		case REJECT_DRAW_REQUEST:
			return reject_draw(ctx, message)
		default:
			return GameSendMessage{TYPE: REJECT, GameId: message.GameId}
		}
	}
	return PlayerMessage{TYPE: REJECT}
}

// writeWSMessage takes a context, WebSocket connection, and message value, writes the value as
// JSON, and returns any write error.
func writeWSMessage(ctx context.Context, conn *websocket.Conn, writeMsg any) error {
	writeCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	return wsjson.Write(writeCtx, conn, writeMsg)
}

// close_connection takes a WebSocket connection, closes it with an internal-error status when
// non-nil, and returns no value.
func close_connection(conn *websocket.Conn) {
	if conn != nil {
		_ = conn.Close(websocket.StatusInternalError, websocket.StatusInternalError.String())
	}
}

// websocket_main initializes the in-process active-game map. It takes no arguments and returns
// no value.
func websocket_main() {
	activeGamesMutex.Lock()
	active_games = make(map[string]*chess.Game)
	activeGamesMutex.Unlock()
}
