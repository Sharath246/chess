package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/coder/websocket"
)

type MESSAGE_TYPE string

type PlayerMessage struct {
	Username         string       `json:"username"`
	TYPE             MESSAGE_TYPE `json:"type"`
	OpponentUsername string       `json:"opponentUsername"`
}

type Move_Type struct {
	From           string `json:"from"`
	To             string `json:"to"`
	PromotionPiece string `json:"promotionPiece"`
}

type GameReceiveMessage struct {
	Username string       `json:"username"`
	Color    string       `json:"color"`
	TYPE     MESSAGE_TYPE `json:"type"`
	GameId   string       `json:"gameId"`
	Move     string       `json:"move,omitempty"`
	Time     float64      `json:"time"`
}

type GameSendMessage struct {
	TYPE      MESSAGE_TYPE `json:"type"`
	GameId    string       `json:"gameId"`
	WhiteTime float64      `json:"whiteTime,omitempty"`
	BlackTime float64      `json:"blackTime,omitempty"`
	FEN       string       `json:"fen,omitempty"` //TODO Check fen vs direct move
	Color     string       `json:"color,omitempty"`
	Winner    string       `json:"winner,omitempty"`
	Result    string       `json:"result,omitempty"`
}

type PlayerInfo struct {
	Username string
	Conn     *websocket.Conn
}

type GameInfo struct {
	FEN       string  `json:"fen"`
	GameId    string  `json:"gameId"`
	WhiteId   string  `json:"whiteId"`
	BlackId   string  `json:"blackId"`
	WhiteTime float64 `json:"whiteTime"`
	BlackTime float64 `json:"blackTime"`
}

const (
	PLAYER_CONN_INFO string = "PLAYER_CONN_INFO:"
	PLAYER_STATUS    string = "PLAYER_STATUS:"
	PLAYER_GAMES     string = "PLAYER_GAMES:"
	GAME_INFO        string = "GAME_INFO:"
	WHITE            string = "white"
	BLACK            string = "black"

	READY_FOR_GAME       MESSAGE_TYPE = "READY_FOR_GAME"
	REQUEST_GAME         MESSAGE_TYPE = "REQUEST_GAME"
	ACCEPT_GAME_REQUEST  MESSAGE_TYPE = "ACCEPT_GAME_REQUEST"
	REJECT_GAME_REQUEST  MESSAGE_TYPE = "REJECT_GAME_REQUEST"
	ACCEPT_DRAW_REQUEST  MESSAGE_TYPE = "ACCEPT_DRAW_REQUEST"
	REJECT_DRAW_REQUEST  MESSAGE_TYPE = "REJECT_DRAW_REQUEST"
	ACCEPT               MESSAGE_TYPE = "ACCEPT"
	REJECT               MESSAGE_TYPE = "REJECT"
	ONLINE               MESSAGE_TYPE = "ONLINE"
	PLAYING_GAME         MESSAGE_TYPE = "PLAYING_GAME"
	MAKE_MOVE            MESSAGE_TYPE = "MAKE_MOVE"
	INVALID_MOVE         MESSAGE_TYPE = "INVALID_MOVE"
	NOT_YOUR_TURN        MESSAGE_TYPE = "NOT_YOUR_TURN"
	DECLARE_RESULT       MESSAGE_TYPE = "DECLARE_RESULT"
	GAME_REQUEST         MESSAGE_TYPE = "GAME_REQUEST:"
	DRAW_REQUEST         MESSAGE_TYPE = "DRAW_REQUEST:"
	OFFER_DRAW           MESSAGE_TYPE = "OFFER_DRAW"
	RESIGN_GAME          MESSAGE_TYPE = "RESIGN_GAME"
	PLAYER_NOT_AVAILABLE MESSAGE_TYPE = "PLAYER_NOT_AVAILABLE"
	START_GAME           MESSAGE_TYPE = "START_GAME"
	PAIRED               MESSAGE_TYPE = "PAIRED"
	TIME_MISMATCH        MESSAGE_TYPE = "TIME_MISMATCH"
	TIMEOUT              MESSAGE_TYPE = "TIMEOUT"

	INTERNAL_SERVER_ERROR MESSAGE_TYPE = "INTERNAL_SERVER_ERROR"
	INVALID_MESSAGE       MESSAGE_TYPE = "INVALID_MESSAGE"
)

// decodeWebSocketMessage takes raw JSON from a WebSocket, identifies its message category,
// and returns a PlayerMessage or GameReceiveMessage. It returns an error for invalid or
// unsupported messages.
func decodeWebSocketMessage(rawMessage json.RawMessage) (any, error) {
	var envelope struct {
		TYPE MESSAGE_TYPE `json:"type"`
	}
	if err := json.Unmarshal(rawMessage, &envelope); err != nil {
		return nil, err
	}
	if envelope.TYPE == "" {
		return nil, fmt.Errorf("message type is required")
	}

	if isGameMessageType(envelope.TYPE) {
		var message GameReceiveMessage
		if err := json.Unmarshal(rawMessage, &message); err != nil {
			return nil, err
		}
		return message, nil
	}

	if isPlayerMessageType(envelope.TYPE) {
		var message PlayerMessage
		if err := json.Unmarshal(rawMessage, &message); err != nil {
			return nil, err
		}
		return message, nil
	}

	return nil, fmt.Errorf("unsupported message type %q", envelope.TYPE)
}

// isGameMessageType takes a protocol message type and returns whether it belongs to the
// game-message category.
func isGameMessageType(messageType MESSAGE_TYPE) bool {
	switch messageType {
	case PLAYING_GAME, MAKE_MOVE, INVALID_MOVE, NOT_YOUR_TURN, DECLARE_RESULT, OFFER_DRAW, RESIGN_GAME, START_GAME, ACCEPT_DRAW_REQUEST, REJECT_DRAW_REQUEST:
		return true
	default:
		return false
	}
}

// isPlayerMessageType takes a protocol message type and returns whether it belongs to the
// player or matchmaking-message category.
func isPlayerMessageType(messageType MESSAGE_TYPE) bool {
	switch messageType {
	case READY_FOR_GAME, REQUEST_GAME, ACCEPT_GAME_REQUEST, REJECT_GAME_REQUEST, ACCEPT, REJECT, ONLINE, PLAYER_NOT_AVAILABLE, PAIRED:
		return true
	default:
		return false
	}
}

// getMillisecondTime takes a numeric multiplier and a duration unit, then returns the
// multiplied duration expressed in microseconds.
func getMillisecondTime(val float64, timeType time.Duration) float64 {
	return val * float64(timeType.Microseconds())
}
