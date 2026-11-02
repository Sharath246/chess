package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"slices"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"crypto/rand"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/notnil/chess"
	"github.com/redis/go-redis/v9"
)

func game_connection(username string, conn *websocket.Conn, ctx context.Context) {
	playerConnMutex.Lock()
	player_conn_info[username] = conn
	playerConnMutex.Unlock()
	// This cleanup closure takes no arguments, removes this connection only if it is still
	// the player's current socket, and clears that player's Redis status; it returns nothing.
	defer func() {
		playerConnMutex.Lock()
		isCurrentConnection := player_conn_info[username] == conn
		if isCurrentConnection {
			delete(player_conn_info, username)
		}
		playerConnMutex.Unlock()

		if isCurrentConnection {
			_ = delete_redis_key(PLAYER_STATUS + username)
		}
	}()
	defer handle_conn_teardown(conn, username)

	if err := transition_player_status(username, ONLINE); err != nil {
		close_connection(conn)
		return
	}

	fmt.Println("Client connected:", username)
	for {
		var rawMessage json.RawMessage
		readCtx, cancel := context.WithCancel(ctx)
		err := wsjson.Read(readCtx, conn, &rawMessage)
		cancel()
		if err != nil {
			return
		}

		readMsg, err := decodeWebSocketMessage(rawMessage)
		if err != nil {
			log.Printf("Invalid message: %v", err)
			_ = writeWSMessage(ctx, conn, PlayerMessage{TYPE: REJECT})
			continue
		}

		writeMsg := processMessage(ctx, conn, username, readMsg)
		if writeMsg != nil {
			if err := writeWSMessage(ctx, conn, writeMsg); err != nil {
				close_connection(conn)
				return
			}
		}
	}
}

// handle_conn_teardown takes a WebSocket connection and username, awards every active game
// to the connected opponent, and removes ended game records. It writes result messages and
// Redis updates and returns no Go value.
func handle_conn_teardown(conn *websocket.Conn, username string) {
	playerConnMutex.RLock()
	isCurrentConnection := player_conn_info[username] == conn
	playerConnMutex.RUnlock()
	if !isCurrentConnection {
		return
	}

	gameIDs, err := rdb.SMembers(ctx, PLAYER_GAMES+username).Result()
	if err != nil {
		log.Printf("Could not find active games for %s during disconnect: %v", username, err)
		return
	}

	for _, gameID := range gameIDs {
		gameInfoJSON, err := get_redis_key(GAME_INFO + gameID)
		if err != nil {
			_ = rdb.SRem(ctx, PLAYER_GAMES+username, gameID).Err()
			continue
		}

		var gameInfo GameInfo
		if err := json.Unmarshal([]byte(gameInfoJSON), &gameInfo); err != nil {
			log.Printf("Could not read game %s during disconnect: %v", gameID, err)
			_ = rdb.SRem(ctx, PLAYER_GAMES+username, gameID).Err()
			continue
		}

		opponent := gameInfo.BlackId
		winnerColor := BLACK
		if username == gameInfo.BlackId {
			opponent = gameInfo.WhiteId
			winnerColor = WHITE
		} else if username != gameInfo.WhiteId {
			_ = rdb.SRem(ctx, PLAYER_GAMES+username, gameID).Err()
			continue
		}

		if opponentConn, ok := get_player_connection(opponent); ok {
			result := GameSendMessage{
				TYPE:   DECLARE_RESULT,
				GameId: gameID,
				Result: "Opponent disconnected",
				Winner: winnerColor,
			}
			if err := writeWSMessage(context.Background(), opponentConn, result); err != nil {
				log.Printf("Could not notify %s that they won game %s: %v", opponent, gameID, err)
			}
			if err := transition_player_status(opponent, ONLINE); err != nil {
				log.Printf("Could not update %s status after disconnect: %v", opponent, err)
			}
		} else {
			_ = delete_redis_key(PLAYER_STATUS + opponent)
		}

		remove_game_record(ctx, gameInfo)
	}
}

// make_conn_ready_for_game takes a player message, updates that player's Redis status to
// ready when possible, and returns ACCEPT or REJECT with the player identity.
func make_conn_ready_for_game(msg PlayerMessage) PlayerMessage {
	if err := transition_player_status(msg.Username, READY_FOR_GAME); err != nil {
		return PlayerMessage{Username: msg.Username, TYPE: REJECT}
	}
	return PlayerMessage{Username: msg.Username, TYPE: ACCEPT}
}

// request_game takes a context and matchmaking request, forwards the request to the named
// opponent when both players are ready, and returns the requester-facing protocol response.
func request_game(ctx context.Context, msg PlayerMessage) PlayerMessage { // TODO minor: we can check the statuses (his an opponents) first and then move on
	state, err := get_redis_key(PLAYER_STATUS + msg.Username)
	if err != nil || MESSAGE_TYPE(state) != READY_FOR_GAME {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT}
	}
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: REQUEST_GAME}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername}
	opponentConn, ok := get_player_connection(message.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_AVAILABLE
	} else if opponentState, _ := get_redis_key(PLAYER_STATUS + msg.OpponentUsername); MESSAGE_TYPE(opponentState) == READY_FOR_GAME {
		if err := transition_player_status(msg.Username, REQUEST_GAME); err != nil {
			message.TYPE = REJECT
		} else if err := writeWSMessage(ctx, opponentConn, opponentRequestMessage); err != nil {
			close_connection(opponentConn)
			_ = transition_player_status(msg.Username, READY_FOR_GAME)
			message.TYPE = PLAYER_NOT_AVAILABLE
		} else {
			_ = set_redis_key(string(GAME_REQUEST)+msg.OpponentUsername, msg.Username, 0)
			message.TYPE = ACCEPT_GAME_REQUEST
		}
	} else {
		message.TYPE = REJECT_GAME_REQUEST
	}
	return message
}

// accept_game takes a context, accepting player's connection, and request message; it pairs
// the players and notifies both connections. It returns the pairing outcome as a PlayerMessage.
func accept_game(ctx context.Context, playerConn *websocket.Conn, msg PlayerMessage) PlayerMessage {
	requester, err := get_redis_key(string(GAME_REQUEST) + msg.Username)
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
		message.TYPE = PLAYER_NOT_AVAILABLE
	} else {
		if err := transition_player_status(msg.OpponentUsername, PAIRED); err != nil {
			return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT_GAME_REQUEST}
		}
		if err := transition_player_status(msg.Username, PAIRED); err != nil {
			_ = transition_player_status(msg.OpponentUsername, READY_FOR_GAME)
			return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT_GAME_REQUEST}
		}
		playerOneErr := writeWSMessage(ctx, opponentConn, opponentRequestMessage)
		playerTwoErr := writeWSMessage(ctx, playerConn, message)
		if playerOneErr != nil || playerTwoErr != nil {
			close_connection(playerConn)
			close_connection(opponentConn)
		}
		_ = delete_redis_key(string(GAME_REQUEST) + msg.Username)
	}
	return message
}

// decline_game takes a context and rejection message, notifies the requester, resets their
// matchmaking state when possible, and returns the resulting PlayerMessage.
func decline_game(ctx context.Context, msg PlayerMessage) PlayerMessage {
	requester, err := get_redis_key(string(GAME_REQUEST) + msg.Username)
	if err != nil || requester != msg.OpponentUsername {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT}
	}
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: REJECT_GAME_REQUEST}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername}
	opponentConn, ok := get_player_connection(msg.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_AVAILABLE
	} else if opponentState, _ := get_redis_key(PLAYER_STATUS + msg.OpponentUsername); MESSAGE_TYPE(opponentState) == REQUEST_GAME {
		if err := writeWSMessage(ctx, opponentConn, opponentRequestMessage); err != nil {
			close_connection(opponentConn)
			message.TYPE = PLAYER_NOT_AVAILABLE
		} else {
			_ = delete_redis_key(string(GAME_REQUEST) + msg.Username)
			if err := transition_player_status(msg.OpponentUsername, READY_FOR_GAME); err != nil {
				message.TYPE = REJECT
				return message
			}
			message.TYPE = ACCEPT_GAME_REQUEST
		}
	} else {
		message.TYPE = REJECT
	}
	return message
}

// assign_colors takes two usernames and randomly assigns them to white and black, returning
// the white username first and the black username second.
func assign_colors(player1 string, player2 string) (string, string) {
	randomNumber, _ := rand.Int(rand.Reader, big.NewInt(2))
	if randomNumber.Cmp(big.NewInt(1)) >= 0 {
		return player1, player2
	}
	return player2, player1
}

// start_game takes a context and two usernames, creates and stores a game when both players
// are paired, and sends each player's start message. It returns the white and black usernames.
func start_game(ctx context.Context, player1 string, player2 string) (string, string) {
	whiteID, blackID := assign_colors(player1, player2)
	blackConn, blackOK := get_player_connection(blackID)
	whiteConn, whiteOK := get_player_connection(whiteID)
	playerOneState, _ := get_redis_key(PLAYER_STATUS + player1)
	playerTwoState, _ := get_redis_key(PLAYER_STATUS + player2)
	if !blackOK {
		_ = writeWSMessage(ctx, whiteConn, PlayerMessage{Username: whiteID, OpponentUsername: blackID, TYPE: PLAYER_NOT_AVAILABLE})
	} else if !whiteOK {
		_ = writeWSMessage(ctx, blackConn, PlayerMessage{Username: blackID, OpponentUsername: whiteID, TYPE: PLAYER_NOT_AVAILABLE})
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
		if err := rdb.SAdd(ctx, PLAYER_GAMES+whiteID, gameID).Err(); err != nil {
			remove_game_record(ctx, gameInfo)
			_ = writeWSMessage(ctx, whiteConn, PlayerMessage{TYPE: REJECT})
			_ = writeWSMessage(ctx, blackConn, PlayerMessage{TYPE: REJECT})
			return whiteID, blackID
		}
		if err := rdb.SAdd(ctx, PLAYER_GAMES+blackID, gameID).Err(); err != nil {
			remove_game_record(ctx, gameInfo)
			_ = writeWSMessage(ctx, whiteConn, PlayerMessage{TYPE: REJECT})
			_ = writeWSMessage(ctx, blackConn, PlayerMessage{TYPE: REJECT})
			return whiteID, blackID
		}
		if err := transition_player_status(whiteID, PLAYING_GAME); err != nil {
			remove_game_record(ctx, gameInfo)
			_ = writeWSMessage(ctx, whiteConn, PlayerMessage{TYPE: REJECT})
			_ = writeWSMessage(ctx, blackConn, PlayerMessage{TYPE: REJECT})
			return whiteID, blackID
		}
		if err := transition_player_status(blackID, PLAYING_GAME); err != nil {
			_ = transition_player_status(whiteID, PAIRED)
			remove_game_record(ctx, gameInfo)
			_ = writeWSMessage(ctx, whiteConn, PlayerMessage{TYPE: REJECT})
			_ = writeWSMessage(ctx, blackConn, PlayerMessage{TYPE: REJECT})
			return whiteID, blackID
		}
		whiteGameMessage := GameSendMessage{TYPE: START_GAME, FEN: fen, GameId: gameID, Color: WHITE}
		blackGameMessage := GameSendMessage{TYPE: START_GAME, FEN: fen, GameId: gameID, Color: BLACK}
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

// get_game takes a game ID, loads its metadata from Redis, and returns the in-process chess
// game, its metadata, and any Redis, JSON, or FEN parsing error.
func get_game(gameID string) (*chess.Game, GameInfo, error) {
	activeGamesMutex.RLock()
	game, ok := active_games[gameID]
	activeGamesMutex.RUnlock()
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
		activeGamesMutex.Lock()
		if existingGame, exists := active_games[gameID]; exists {
			game = existingGame
		} else {
			active_games[gameID] = game
		}
		activeGamesMutex.Unlock()
	}
	return game, gameInfo, nil
}

// remove_game_record takes a context and game metadata, deletes the game from Redis player
// indexes and the in-process game map, and returns no value.
func remove_game_record(ctx context.Context, gameInfo GameInfo) {
	_ = delete_redis_key(GAME_INFO + gameInfo.GameId)
	_ = rdb.SRem(ctx, PLAYER_GAMES+gameInfo.WhiteId, gameInfo.GameId).Err()
	_ = rdb.SRem(ctx, PLAYER_GAMES+gameInfo.BlackId, gameInfo.GameId).Err()

	activeGamesMutex.Lock()
	delete(active_games, gameInfo.GameId)
	activeGamesMutex.Unlock()
}

// check_time takes a move message, game metadata, and the mover's chess color, then returns
// whether the submitted time is acceptable and the corresponding protocol result type.
func check_time(msg GameReceiveMessage, gameInfo GameInfo, turn chess.Color) (bool, MESSAGE_TYPE) {
	// check_time_great takes submitted and stored clock values and reports whether the submitted
	// value is greater than or equal to the stored value; it returns a boolean.
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

// check_move_msg takes a context, game state and metadata, move message, and both player
// connections. It validates time, player turn, and move legality; it broadcasts the new state
// or result and returns success plus the protocol result type.
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
		if err := transition_player_status(gameInfo.WhiteId, ONLINE); err != nil {
			log.Printf("Could not update white player status after game completion: %v", err)
		}
		if err := transition_player_status(gameInfo.BlackId, ONLINE); err != nil {
			log.Printf("Could not update black player status after game completion: %v", err)
		}
		remove_game_record(ctx, gameInfo)
		return true, DECLARE_RESULT
	}
	validMoveMessage := GameSendMessage{TYPE: MAKE_MOVE, FEN: game.FEN(), GameId: gameInfo.GameId}
	_ = writeWSMessage(ctx, whiteConn, validMoveMessage)
	_ = writeWSMessage(ctx, blackConn, validMoveMessage)
	return true, MAKE_MOVE
}

// make_game_move takes a context and move message, retrieves the game and player connections,
// and delegates validation and broadcasting. It returns a response message or nil when the
// completion result was already broadcast.
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

// offer_draw takes a context and draw-offer message, validates the game participant, stores
// the pending offer, and notifies the opponent. It returns an acceptance or rejection message.
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
	if err := set_redis_key(string(DRAW_REQUEST)+opponent, msg.Username, 0); err != nil {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: OFFER_DRAW, GameId: msg.GameId}); err != nil {
		_ = delete_redis_key(string(DRAW_REQUEST) + opponent)
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}
	}
	return GameSendMessage{TYPE: ACCEPT, GameId: msg.GameId}
}

// resign_game takes a context and resignation message, verifies the player and game, notifies
// the opponent of the winning color, ends the game, and returns the result message.
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
	if err := transition_player_status(msg.Username, ONLINE); err != nil {
		log.Printf("Could not update resigning player status: %v", err)
	}
	if err := transition_player_status(opponent, ONLINE); err != nil {
		log.Printf("Could not update opponent status after resignation: %v", err)
	}
	remove_game_record(ctx, gameInfo)
	return GameSendMessage{TYPE: RESIGN_GAME, GameId: msg.GameId, Winner: winnerColor}
}

// accept_draw takes a context and draw-response message, notifies the offerer, marks both
// players available, removes the ended game, and returns the draw result or rejection.
func accept_draw(ctx context.Context, msg GameReceiveMessage) GameSendMessage {
	requester, err := get_redis_key(string(DRAW_REQUEST) + msg.Username)
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
	_ = delete_redis_key(string(DRAW_REQUEST) + msg.Username)
	if err := transition_player_status(msg.Username, ONLINE); err != nil {
		log.Printf("Could not update accepting player's status after draw: %v", err)
	}
	if err := transition_player_status(requester, ONLINE); err != nil {
		log.Printf("Could not update offering player's status after draw: %v", err)
	}
	remove_game_record(ctx, gameInfo)
	return GameSendMessage{TYPE: ACCEPT_DRAW_REQUEST, GameId: msg.GameId}
}

// reject_draw takes a context and draw-response message, notifies the offerer, clears the
// pending request, and returns the draw-rejection message.
func reject_draw(ctx context.Context, msg GameReceiveMessage) GameSendMessage {
	requester, err := get_redis_key(string(DRAW_REQUEST) + msg.Username)
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
	_ = delete_redis_key(string(DRAW_REQUEST) + msg.Username)
	return GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}
}

func canTransition(from, to MESSAGE_TYPE) bool {
	switch from {
	case ONLINE:
		return slices.Contains([]MESSAGE_TYPE{READY_FOR_GAME, ONLINE}, to)
	case READY_FOR_GAME:
		return slices.Contains([]MESSAGE_TYPE{REQUEST_GAME, PAIRED}, to)
	case REQUEST_GAME:
		return slices.Contains([]MESSAGE_TYPE{READY_FOR_GAME, PAIRED}, to)
	case PAIRED:
		return slices.Contains([]MESSAGE_TYPE{PLAYING_GAME, READY_FOR_GAME}, to)
	case PLAYING_GAME:
		return slices.Contains([]MESSAGE_TYPE{PLAYING_GAME, ONLINE}, to)
	default:
		return false
	}
}

// transition_player_status takes a username and requested status, validates the current Redis
// status against canTransition function, and stores the new status. It returns a Redis or transition error.
func transition_player_status(username string, requestedStatus MESSAGE_TYPE) error {
	currentValue, err := get_redis_key(PLAYER_STATUS + username)
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}
	currentStatus := MESSAGE_TYPE(currentValue)
	if canTransition(currentStatus, requestedStatus) {
		return set_redis_key(PLAYER_STATUS+username, string(requestedStatus), 0)
	}
	return fmt.Errorf("invalid player status transition for %q: %q to %q", username, currentStatus, requestedStatus)
}
