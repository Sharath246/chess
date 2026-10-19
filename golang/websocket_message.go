package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"math/big"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/google/uuid"
	"github.com/notnil/chess"
)

var active_games map[string]*chess.Game

func make_conn_ready_for_game(msg PlayerMessage) PlayerMessage {
	state, err := get_redis_key(PLAYER_STATUS + msg.Username)
	if err != nil {
		return PlayerMessage{Username: msg.Username, TYPE: REJECT}
	}
	if state != string(ONLINE) && state != "" {
		return PlayerMessage{Username: msg.Username, TYPE: REJECT}
	}
	if err := set_redis_key(PLAYER_STATUS+msg.Username, string(READY_FOR_GAME), 0); err != nil {
		return PlayerMessage{Username: msg.Username, TYPE: REJECT}
	}
	return PlayerMessage{Username: msg.Username, TYPE: ACCEPT}
}

func request_game(ctx context.Context, msg PlayerMessage) PlayerMessage {
	state, err := get_redis_key(PLAYER_STATUS + msg.Username)
	if err != nil || MESSAGE_TYPE(state) != READY_FOR_GAME {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT}
	}
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: REQUEST_GAME}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername}
	opponentConn, ok := get_player_connection(message.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_ONLINE
	} else if opponentState, _ := get_redis_key(PLAYER_STATUS + msg.OpponentUsername); MESSAGE_TYPE(opponentState) == READY_FOR_GAME {
		if err := writeWSMessage(ctx, opponentConn, opponentRequestMessage); err != nil {
			close_connection(opponentConn)
			message.TYPE = PLAYER_NOT_ONLINE
		} else {
			_ = set_redis_key(PLAYER_STATUS+msg.Username, string(REQUEST_GAME), 0)
			_ = set_redis_key(GAME_REQUEST+msg.OpponentUsername, msg.Username, 0)
			message.TYPE = ACCEPT_GAME_REQUEST
		}
	} else {
		message.TYPE = REJECT_GAME_REQUEST
	}
	return message
}

func accept_game(ctx context.Context, playerConn *websocket.Conn, msg PlayerMessage) PlayerMessage {
	requester, err := get_redis_key(GAME_REQUEST + msg.Username)
	if err != nil || requester != msg.OpponentUsername {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT_GAME_REQUEST}
	}
	playerState, _ := get_redis_key(PLAYER_STATUS + msg.Username)
	opponentState, _ := get_redis_key(PLAYER_STATUS + msg.OpponentUsername)
	if MESSAGE_TYPE(playerState) != READY_FOR_GAME || MESSAGE_TYPE(opponentState) != REQUEST_GAME {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT_GAME_REQUEST}
	}
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: PAIRED}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: PAIRED}
	opponentConn, ok := get_player_connection(msg.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_ONLINE
	} else {
		playerOneErr := writeWSMessage(ctx, opponentConn, opponentRequestMessage)
		playerTwoErr := writeWSMessage(ctx, playerConn, message)
		if playerOneErr != nil || playerTwoErr != nil {
			close_connection(playerConn)
			close_connection(opponentConn)
		}
		set_redis_key(PLAYER_STATUS+msg.OpponentUsername, string(PAIRED), 0)
		set_redis_key(PLAYER_STATUS+msg.Username, string(PAIRED), 0)
		_ = delete_redis_key(GAME_REQUEST + msg.Username)
	}
	return message
}

func decline_game(ctx context.Context, msg PlayerMessage) PlayerMessage {
	requester, err := get_redis_key(GAME_REQUEST + msg.Username)
	if err != nil || requester != msg.OpponentUsername {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT}
	}
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: REJECT_GAME_REQUEST}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername}
	opponentConn, ok := get_player_connection(msg.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_ONLINE
	} else if opponentState, _ := get_redis_key(PLAYER_STATUS + msg.OpponentUsername); MESSAGE_TYPE(opponentState) == REQUEST_GAME {
		if err := writeWSMessage(ctx, opponentConn, opponentRequestMessage); err != nil {
			close_connection(opponentConn)
			message.TYPE = PLAYER_NOT_ONLINE
		} else {
			_ = delete_redis_key(GAME_REQUEST + msg.Username)
			_ = set_redis_key(PLAYER_STATUS+msg.OpponentUsername, string(READY_FOR_GAME), 0)
			message.TYPE = ACCEPT_GAME_REQUEST
		}
	} else {
		message.TYPE = REJECT
	}
	return message
}

func get_player_ids(player1 string, player2 string) (string, string) {
	randomNumber, _ := rand.Int(rand.Reader, big.NewInt(2))
	if randomNumber.Cmp(big.NewInt(1)) >= 0 {
		return player1, player2
	}
	return player2, player1
}

func getMillisecondTime(val float64, timeType time.Duration) float64 {
	return val * float64(timeType.Microseconds())
}

func start_game(ctx context.Context, player1 string, player2 string) (string, string) {
	whiteID, blackID := get_player_ids(player1, player2)
	blackConn, blackOK := get_player_connection(blackID)
	whiteConn, whiteOK := get_player_connection(whiteID)
	playerOneState, _ := get_redis_key(PLAYER_STATUS + player1)
	playerTwoState, _ := get_redis_key(PLAYER_STATUS + player2)
	if !blackOK {
		_ = writeWSMessage(ctx, whiteConn, PlayerMessage{Username: whiteID, OpponentUsername: blackID, TYPE: PLAYER_NOT_ONLINE})
	} else if !whiteOK {
		_ = writeWSMessage(ctx, blackConn, PlayerMessage{Username: blackID, OpponentUsername: whiteID, TYPE: PLAYER_NOT_ONLINE})
	} else if MESSAGE_TYPE(playerOneState) == PAIRED && MESSAGE_TYPE(playerTwoState) == PAIRED {
		gameID := uuid.NewString()
		fen := chess.NewGame().FEN()
		gameInfo := GameInfo{
			GameId:    gameID,
			WhiteId:   whiteID,
			BlackId:   blackID,
			FEN:       fen,
			BlackTime: getMillisecondTime(10, time.Minute),
			WhiteTime: getMillisecondTime(10, time.Minute),
		}
		gameInfoJSON, err := json.Marshal(gameInfo)
		if err != nil {
			return whiteID, blackID
		}
		if err := set_redis_key(GAME_INFO+gameID, string(gameInfoJSON), 0); err != nil {
			return whiteID, blackID
		}
		_ = set_redis_key(PLAYER_STATUS+whiteID, string(PLAYING_GAME), 0)
		_ = set_redis_key(PLAYER_STATUS+blackID, string(PLAYING_GAME), 0)
		whiteGameMessage := GameSendMessage{FEN: fen, GameId: gameID, Color: WHITE}
		blackGameMessage := GameSendMessage{FEN: fen, GameId: gameID, Color: BLACK}
		if writeWSMessage(ctx, blackConn, blackGameMessage) != nil || writeWSMessage(ctx, whiteConn, whiteGameMessage) != nil {
			close_connection(blackConn)
			close_connection(whiteConn)
		}
	} else {
		message := PlayerMessage{Username: whiteID, OpponentUsername: blackID, TYPE: REJECT}
		_ = writeWSMessage(ctx, whiteConn, message)
		_ = writeWSMessage(ctx, blackConn, message)
	}
	return whiteID, blackID
}

func get_game(gameID string) (*chess.Game, GameInfo, error) {
	game, ok := active_games[gameID]
	value, err := get_redis_key(GAME_INFO + gameID)
	if err != nil {
		return nil, GameInfo{}, err
	}
	var gameInfo GameInfo
	if err := json.Unmarshal([]byte(value), &gameInfo); err != nil {
		return nil, GameInfo{}, err
	}
	if !ok {
		fenOptions, err := chess.FEN(gameInfo.FEN)
		if err != nil {
			return nil, GameInfo{}, err
		}
		game = chess.NewGame(fenOptions)
		active_games[gameID] = game
	}
	return game, gameInfo, nil
}

func check_time(msg GameReceiveMessage, gameInfo GameInfo, turn chess.Color) (bool, MESSAGE_TYPE) {
	check_time_great := func(timeReceived float64, prevTime float64) bool {
		return timeReceived >= prevTime
	}

	if turn == chess.Black {
		if check_time_great(msg.Time, gameInfo.BlackTime) {
			return false, TIME_MISMATCH
		}
	} else {
		if check_time_great(msg.Time, gameInfo.WhiteTime) {
			return false, TIME_MISMATCH
		}
	}

	return true, ""
}

func check_move_msg(ctx context.Context, game *chess.Game, gameInfo GameInfo, msg GameReceiveMessage, whiteConn *websocket.Conn, blackConn *websocket.Conn) (bool, MESSAGE_TYPE) {
	turn := chess.Black
	if gameInfo.WhiteId == msg.Username {
		turn = chess.White
	}

	if ok, messageType := check_time(msg, gameInfo, turn); !ok {
		return false, messageType
	}

	if game.Position().Turn() != turn {
		return false, NOT_YOUR_TURN
	}
	notation := chess.AlgebraicNotation{}
	move, err := notation.Decode(game.Position(), msg.Move)
	if err != nil {
		return false, INVALID_MOVE
	}
	if err := game.Move(move); err != nil {
		return false, INVALID_MOVE
	}
	if game.Outcome() != chess.NoOutcome {
		winner := ""
		if game.Outcome() == chess.WhiteWon {
			winner = WHITE
		} else if game.Outcome() == chess.BlackWon {
			winner = BLACK
		}
		completionMessage := GameSendMessage{
			TYPE:   DECLARE_RESULT,
			FEN:    game.FEN(),
			GameId: gameInfo.GameId,
			Result: game.Method().String(),
			Winner: winner,
		}
		_ = writeWSMessage(ctx, whiteConn, completionMessage)
		_ = writeWSMessage(ctx, blackConn, completionMessage)
		_ = set_redis_key(PLAYER_STATUS+gameInfo.WhiteId, string(ONLINE), 0)
		_ = set_redis_key(PLAYER_STATUS+gameInfo.BlackId, string(ONLINE), 0)
		return true, DECLARE_RESULT
	}
	validMoveMessage := GameSendMessage{TYPE: MAKE_MOVE, FEN: game.FEN(), GameId: gameInfo.GameId}
	_ = writeWSMessage(ctx, whiteConn, validMoveMessage)
	_ = writeWSMessage(ctx, blackConn, validMoveMessage)
	return true, MAKE_MOVE
}

func make_game_move(ctx context.Context, msg GameReceiveMessage) any {
	state, err := get_redis_key(PLAYER_STATUS + msg.Username)
	if err != nil || MESSAGE_TYPE(state) != PLAYING_GAME {
		conn, _ := get_player_connection(msg.Username)
		close_connection(conn) //TODO Is this right?
	}
	game, gameInfo, err := get_game(msg.GameId)
	if err != nil {
		conn, _ := get_player_connection(msg.Username)
		close_connection(conn) //TODO Is this right?
	}
	blackConn, blackOK := get_player_connection(gameInfo.BlackId)
	whiteConn, whiteOK := get_player_connection(gameInfo.WhiteId)
	if !blackOK || !whiteOK {
		close_connection(blackConn) //TODO Is this right?
		close_connection(whiteConn) //TODO Is this right?
	}
	valid, resultType := check_move_msg(ctx, game, gameInfo, msg, whiteConn, blackConn)
	if !valid {
		if resultType == TIME_MISMATCH {
			return GameSendMessage{TYPE: resultType, GameId: msg.GameId, BlackTime: gameInfo.BlackTime, WhiteTime: gameInfo.WhiteTime}
		}
		return GameSendMessage{TYPE: resultType, GameId: msg.GameId}
	}
	if resultType == DECLARE_RESULT {
		return nil
	}
	return GameSendMessage{TYPE: MAKE_MOVE, GameId: msg.GameId, FEN: game.FEN()}
}

func offer_draw(ctx context.Context, msg GameReceiveMessage) GameSendMessage {
	_, gameInfo, err := get_game(msg.GameId)
	if err != nil {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	state, err := get_redis_key(PLAYER_STATUS + msg.Username)
	if err != nil || MESSAGE_TYPE(state) != PLAYING_GAME {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	if msg.Username != gameInfo.WhiteId && msg.Username != gameInfo.BlackId {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	opponent := gameInfo.WhiteId
	if opponent == msg.Username {
		opponent = gameInfo.BlackId
	}
	opponentConn, ok := get_player_connection(opponent)
	if !ok {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	if err := set_redis_key(DRAW_REQUEST+opponent, msg.Username, 0); err != nil {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: OFFER_DRAW, GameId: msg.GameId}); err != nil {
		_ = delete_redis_key(DRAW_REQUEST + opponent)
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	return GameSendMessage{TYPE: ACCEPT, GameId: msg.GameId}
}

func resign_game(ctx context.Context, msg GameReceiveMessage) GameSendMessage {
	_, gameInfo, err := get_game(msg.GameId)
	if err != nil {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	state, err := get_redis_key(PLAYER_STATUS + msg.Username)
	if err != nil || MESSAGE_TYPE(state) != PLAYING_GAME {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	if msg.Username != gameInfo.WhiteId && msg.Username != gameInfo.BlackId {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	opponent := gameInfo.WhiteId
	if opponent == msg.Username {
		opponent = gameInfo.BlackId
	}
	opponentConn, ok := get_player_connection(opponent)
	if !ok {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	winnerColor := WHITE
	if opponent == gameInfo.BlackId {
		winnerColor = BLACK
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: RESIGN_GAME, GameId: msg.GameId, Winner: winnerColor}); err != nil {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	_ = set_redis_key(PLAYER_STATUS+msg.Username, string(ONLINE), 0)
	_ = set_redis_key(PLAYER_STATUS+opponent, string(ONLINE), 0)
	return GameSendMessage{TYPE: RESIGN_GAME, GameId: msg.GameId, Winner: winnerColor}
}

func accept_draw(ctx context.Context, msg GameReceiveMessage) GameSendMessage {
	requester, err := get_redis_key(DRAW_REQUEST + msg.Username)
	if err != nil {
		return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
	}
	_, gameInfo, err := get_game(msg.GameId)
	if err != nil || (msg.Username != gameInfo.WhiteId && msg.Username != gameInfo.BlackId) {
		return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
	}
	opponentConn, ok := get_player_connection(requester)
	if !ok {
		return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: ACCEPT_DRAW_REQUEST, GameId: msg.GameId}); err != nil {
		return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
	}
	_ = delete_redis_key(DRAW_REQUEST + msg.Username)
	_ = set_redis_key(PLAYER_STATUS+msg.Username, string(ONLINE), 0)
	_ = set_redis_key(PLAYER_STATUS+requester, string(ONLINE), 0)
	return GameSendMessage{TYPE: ACCEPT_DRAW_REQUEST, GameId: msg.GameId}
}

func reject_draw(ctx context.Context, msg GameReceiveMessage) GameSendMessage {
	requester, err := get_redis_key(DRAW_REQUEST + msg.Username)
	if err != nil {
		return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
	}
	opponentConn, ok := get_player_connection(requester)
	if !ok {
		return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}); err != nil {
		return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
	}
	_ = delete_redis_key(DRAW_REQUEST + msg.Username)
	return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
}

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

func writeWSMessage(ctx context.Context, conn *websocket.Conn, writeMsg any) error {
	writeCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	return wsjson.Write(writeCtx, conn, writeMsg)
}

func close_connection(conn *websocket.Conn) {
	if conn != nil {
		_ = conn.Close(websocket.StatusInternalError, websocket.StatusInternalError.String())
	}
}

func websocket_main() {
	active_games = make(map[string]*chess.Game)
}
