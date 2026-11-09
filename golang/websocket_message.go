package main

import (
	"context"
	"slices"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/notnil/chess"
)

var activeGames map[string]*chess.Game
var activeGamesMutex sync.RWMutex

// processMessage takes a context, sender connection and username, and a decoded protocol
// message. It dispatches the corresponding matchmaking or game action and returns a response
// message, or nil when the action has already broadcast its result.
func processMessage(ctx context.Context, conn *websocket.Conn, username string, msg any) (any, error) {
	state, err := getRedisKey(PLAYER_STATUS + username)
	if err != nil {
		return nil, err
	}
	if !canPlayerSendMessageType(msg, state) {
		return nil, &game_error{error_code: NOT_ATUHORIZED}
	}
	switch message := msg.(type) {
	case PlayerMessage:
		message.Username = username
		switch message.TYPE {
		case READY_FOR_GAME:
			return readyForGame(message)
		case REQUEST_GAME:
			return requestGame(ctx, message)
		case ACCEPT_GAME_REQUEST:
			response, err := acceptGame(ctx, conn, message)
			return response, err
		case REJECT_GAME_REQUEST:
			return declineGame(ctx, message)
		default:
			return PlayerMessage{Username: message.Username, TYPE: REJECT}, nil
		}
	case GameReceiveMessage:
		message.Username = username
		switch message.TYPE {
		case MAKE_MOVE:
			return makeMove(ctx, message)
		case OFFER_DRAW:
			return offerDraw(ctx, message)
		case RESIGN_GAME:
			return resignGame(ctx, message)
		case ACCEPT_DRAW_REQUEST:
			return acceptDraw(ctx, message)
		case REJECT_DRAW_REQUEST:
			return rejectDraw(ctx, message)
		default:
			return GameSendMessage{TYPE: REJECT, GameId: message.GameId}, nil
		}
	}
	return PlayerMessage{TYPE: REJECT}, nil
}

func canPlayerSendMessageType(msg any, state string) bool {
	switch message := msg.(type) {
	case PlayerMessage:
		switch MESSAGE_TYPE(state) {
		case "":
			return false
		case ONLINE:
			return slices.Contains([]MESSAGE_TYPE{READY_FOR_GAME}, message.TYPE)
		case READY_FOR_GAME:
			return slices.Contains([]MESSAGE_TYPE{REQUEST_GAME, ACCEPT_GAME_REQUEST, REJECT_GAME_REQUEST}, message.TYPE)
		default:
			return false
		}
	case GameReceiveMessage:
		switch MESSAGE_TYPE(state) {
		case "":
			return false
		case PLAYING_GAME:
			return slices.Contains([]MESSAGE_TYPE{MAKE_MOVE, OFFER_DRAW, RESIGN_GAME, ACCEPT_DRAW_REQUEST, REJECT_DRAW_REQUEST}, message.TYPE)
		default:
			return false
		}
	default:
		return false
	}
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
	activeGames = make(map[string]*chess.Game)
	activeGamesMutex.Unlock()
}
