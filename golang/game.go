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
			_ = deleteRedisKey(PLAYER_STATUS + username)
		}
	}()
	defer handle_conn_teardown(conn, username)

	if err := transitionPlayerStatus(username, ONLINE); err != nil {
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

		writeMsg, err := processMessage(ctx, conn, username, readMsg)
		if err != nil {
			writeWSMessage(ctx, conn, err.Error())
		} else if writeMsg != nil {
			writeWSMessage(ctx, conn, writeMsg)
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
		gameInfoJSON, err := getRedisKey(GAME_INFO + gameID)
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

		if opponentConn, ok := getConn(opponent); ok {
			result := GameSendMessage{
				TYPE:   DECLARE_RESULT,
				GameId: gameID,
				Result: "Opponent disconnected",
				Winner: winnerColor,
			}
			if err := writeWSMessage(context.Background(), opponentConn, result); err != nil {
				log.Printf("Could not notify %s that they won game %s: %v", opponent, gameID, err)
			}
			if err := transitionPlayerStatus(opponent, ONLINE); err != nil {
				log.Printf("Could not update %s status after disconnect: %v", opponent, err)
			}
		} else {
			_ = deleteRedisKey(PLAYER_STATUS + opponent)
		}

		removeGameRecord(ctx, gameInfo)
	}
}

// readyForGame takes a player message, updates that player's Redis status to
// ready when possible, and returns ACCEPT or REJECT with the player identity.
func readyForGame(msg PlayerMessage) (any, error) {
	err := transitionPlayerStatus(msg.Username, READY_FOR_GAME)
	if err != nil {
		return nil, err
	} else {
		return PlayerMessage{Username: msg.Username, TYPE: ACCEPT}, nil
	}
}

// requestGame takes a context and matchmaking request, forwards the request to the named
// opponent when both players are ready, and returns the requester-facing protocol response.
func requestGame(ctx context.Context, msg PlayerMessage) (any, error) {
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: REQUEST_GAME}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername}
	opponentConn, ok := getConn(message.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_AVAILABLE
		return message, nil
	}
	opponentState, err := getRedisKey(PLAYER_STATUS + msg.OpponentUsername)
	if err != nil {
		return nil, err
	}
	if MESSAGE_TYPE(opponentState) == READY_FOR_GAME {
		err := transitionPlayerStatus(msg.Username, REQUEST_GAME)
		if err != nil {
			return nil, err
		}
		err = writeWSMessage(ctx, opponentConn, opponentRequestMessage)
		if err != nil {
			return nil, err
		} else {
			err = set_redis_key(string(GAME_REQUEST)+msg.OpponentUsername, msg.Username, 0)
			if err != nil {
				return nil, err
			}
		}
	} else {
		message.TYPE = REJECT
	}
	message.TYPE = ACCEPT
	return message, nil
}

// acceptGame takes a context, accepting player's connection, and request message; it pairs
// the players and notifies both connections. It returns the pairing outcome as a PlayerMessage.
func acceptGame(ctx context.Context, playerConn *websocket.Conn, msg PlayerMessage) (any, error) {
	requester, err := getRedisKey(string(GAME_REQUEST) + msg.Username)
	if err != nil {
		return nil, err
	} else if requester != msg.OpponentUsername {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT_GAME_REQUEST}, nil
	}
	playerState, _ := getRedisKey(PLAYER_STATUS + msg.Username)
	opponentState, _ := getRedisKey(PLAYER_STATUS + msg.OpponentUsername)
	if MESSAGE_TYPE(playerState) != READY_FOR_GAME || MESSAGE_TYPE(opponentState) != REQUEST_GAME {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT_GAME_REQUEST}, nil
	}
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: PAIRED}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: PAIRED}
	opponentConn, ok := getConn(msg.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_AVAILABLE
		return message, nil
	} else {
		err := transitionPlayerStatus(msg.OpponentUsername, PAIRED)
		if err != nil {
			return nil, err
		}
		err = transitionPlayerStatus(msg.Username, PAIRED)
		if err != nil {
			return nil, err
		}
		playerOneErr := writeWSMessage(ctx, opponentConn, opponentRequestMessage)
		if playerOneErr != nil {
			return nil, err
		}
		playerTwoErr := writeWSMessage(ctx, playerConn, message)
		if playerTwoErr != nil {
			return nil, err
		}
		err = deleteRedisKey(string(GAME_REQUEST) + msg.Username)
		if err != nil {
			return nil, err
		}
		player1Info := PlayerInfo{Username: message.Username, Conn: playerConn}
		player2Info := PlayerInfo{Username: message.OpponentUsername, Conn: opponentConn}
		err = startGame(ctx, player1Info, player2Info)
		if err != nil {
			return nil, err
		}
	}
	return message, err
}

// declineGame takes a context and rejection message, notifies the requester, resets their
// matchmaking state when possible, and returns the resulting PlayerMessage.
func declineGame(ctx context.Context, msg PlayerMessage) (any, error) {
	requester, err := getRedisKey(string(GAME_REQUEST) + msg.Username)
	if err != nil {
		return nil, err
	}
	if requester != msg.OpponentUsername {
		return PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername, TYPE: REJECT}, nil
	}
	opponentRequestMessage := PlayerMessage{Username: msg.OpponentUsername, OpponentUsername: msg.Username, TYPE: REJECT_GAME_REQUEST}
	message := PlayerMessage{Username: msg.Username, OpponentUsername: msg.OpponentUsername}
	opponentConn, ok := getConn(msg.OpponentUsername)
	if !ok {
		message.TYPE = PLAYER_NOT_AVAILABLE
		return message, nil
	}
	opponentState, err := getRedisKey(PLAYER_STATUS + msg.OpponentUsername)
	if err != nil {
		return nil, err
	} else if MESSAGE_TYPE(opponentState) == REQUEST_GAME {
		err := writeWSMessage(ctx, opponentConn, opponentRequestMessage)
		if err != nil {
			return nil, err
		} else {
			err = deleteRedisKey(string(GAME_REQUEST) + msg.Username)
			if err != nil {
				return nil, err
			}
			err = transitionPlayerStatus(msg.OpponentUsername, READY_FOR_GAME)
			if err != nil {
				return nil, err
			}
			message.TYPE = ACCEPT
		}
	} else {
		message.TYPE = REJECT
	}
	return message, nil
}

// assignColor takes two usernames and randomly assigns them to white and black, returning
// the white username first and the black username second.
func assignColor(player1, player2 PlayerInfo) (PlayerInfo, PlayerInfo) {
	randomNumber, _ := rand.Int(rand.Reader, big.NewInt(2))
	if randomNumber.Cmp(big.NewInt(1)) >= 0 {
		return player1, player2
	}
	return player2, player1
}

// startGame takes a context and two usernames, creates and stores a game when both players
// are paired, and sends each player's start message. It returns the white and black usernames.
func startGame(ctx context.Context, player1, player2 PlayerInfo) error {
	white, black := assignColor(player1, player2)
	gameID := uuid.NewString()
	fen := chess.NewGame().FEN()
	gameInfo := GameInfo{
		GameId:    gameID,
		WhiteId:   white.Username,
		BlackId:   black.Username,
		FEN:       fen,
		BlackTime: getMillisecondTime(10, time.Minute),
		WhiteTime: getMillisecondTime(10, time.Minute),
	}
	gameInfoJSON, err := json.Marshal(gameInfo)
	if err != nil {
		return err
	}
	if err := set_redis_key(GAME_INFO+gameID, string(gameInfoJSON), 0); err != nil {
		return err
	}
	if err := rdb.SAdd(ctx, PLAYER_GAMES+white.Username, gameID).Err(); err != nil {
		return err
	}
	if err := rdb.SAdd(ctx, PLAYER_GAMES+black.Username, gameID).Err(); err != nil {
		return err
	}
	if err := transitionPlayerStatus(white.Username, PLAYING_GAME); err != nil {
		return err
	}
	if err := transitionPlayerStatus(black.Username, PLAYING_GAME); err != nil {
		return err
	}
	whiteGameMessage := GameSendMessage{TYPE: START_GAME, FEN: fen, GameId: gameID, Color: WHITE}
	blackGameMessage := GameSendMessage{TYPE: START_GAME, FEN: fen, GameId: gameID, Color: BLACK}
	err = writeWSMessage(ctx, black.Conn, blackGameMessage)
	if err != nil {
		return err
	}
	err = writeWSMessage(ctx, white.Conn, whiteGameMessage)
	if err != nil {
		return err
	}
	return nil
}

// getGame takes a game ID, loads its metadata from Redis, and returns the in-process chess
// game, its metadata, and any Redis, JSON, or FEN parsing error.
func getGame(gameID string) (*chess.Game, GameInfo, error) {
	activeGamesMutex.RLock()
	game, ok := activeGames[gameID]
	activeGamesMutex.RUnlock()
	value, err := getRedisKey(GAME_INFO + gameID)
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
		if existingGame, exists := activeGames[gameID]; exists {
			game = existingGame
		} else {
			activeGames[gameID] = game
		}
		activeGamesMutex.Unlock()
	}
	return game, gameInfo, nil
}

// removeGameRecord takes a context and game metadata, deletes the game from Redis player
// indexes and the in-process game map, and returns no value.
func removeGameRecord(ctx context.Context, gameInfo GameInfo) {
	_ = deleteRedisKey(GAME_INFO + gameInfo.GameId)
	_ = rdb.SRem(ctx, PLAYER_GAMES+gameInfo.WhiteId, gameInfo.GameId).Err()
	_ = rdb.SRem(ctx, PLAYER_GAMES+gameInfo.BlackId, gameInfo.GameId).Err()

	activeGamesMutex.Lock()
	delete(activeGames, gameInfo.GameId)
	activeGamesMutex.Unlock()
}

// checkTime takes a move message, game metadata, and the mover's chess color, then returns
// whether the submitted time is acceptable and the corresponding protocol result type.
func checkTime(msg GameReceiveMessage, gameInfo GameInfo, turn chess.Color) (bool, MESSAGE_TYPE) {
	// checkTime_great takes submitted and stored clock values and reports whether the submitted
	// value is greater than or equal to the stored value; it returns a boolean.
	checkTime_great := func(timeReceived float64, prevTime float64) bool {
		return timeReceived >= prevTime
	}

	if turn == chess.Black {
		if checkTime_great(msg.Time, gameInfo.BlackTime) {
			return false, TIME_MISMATCH
		}
	} else {
		if checkTime_great(msg.Time, gameInfo.WhiteTime) {
			return false, TIME_MISMATCH
		}
	}

	return true, ""
}

// TODO here
// checkMove takes a context, game state and metadata, move message, and both player
// connections. It validates time, player turn, and move legality; it broadcasts the new state
// or result and returns success plus the protocol result type.
func checkMove(ctx context.Context, game *chess.Game, gameInfo GameInfo, msg GameReceiveMessage, whiteConn *websocket.Conn, blackConn *websocket.Conn) (bool, MESSAGE_TYPE) {
	turn := chess.Black
	if gameInfo.WhiteId == msg.Username {
		turn = chess.White
	}

	if ok, messageType := checkTime(msg, gameInfo, turn); !ok {
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
		if err := transitionPlayerStatus(gameInfo.WhiteId, ONLINE); err != nil {
			log.Printf("Could not update white player status after game completion: %v", err)
		}
		if err := transitionPlayerStatus(gameInfo.BlackId, ONLINE); err != nil {
			log.Printf("Could not update black player status after game completion: %v", err)
		}
		removeGameRecord(ctx, gameInfo)
		return true, DECLARE_RESULT
	}
	validMoveMessage := GameSendMessage{TYPE: MAKE_MOVE, FEN: game.FEN(), GameId: gameInfo.GameId}
	_ = writeWSMessage(ctx, whiteConn, validMoveMessage)
	_ = writeWSMessage(ctx, blackConn, validMoveMessage)
	return true, MAKE_MOVE
}

// makeMove takes a context and move message, retrieves the game and player connections,
// and delegates validation and broadcasting. It returns a response message or nil when the
// completion result was already broadcast.
func makeMove(ctx context.Context, msg GameReceiveMessage) (any, error) {
	game, gameInfo, err := getGame(msg.GameId)
	if err != nil {
		return nil, err
	}
	blackConn, blackOK := getConn(gameInfo.BlackId)
	whiteConn, whiteOK := getConn(gameInfo.WhiteId)
	if !blackOK || !whiteOK {
		return nil, fmt.Errorf("Internal Error while retreiving the game info.")
	}
	valid, resultType := checkMove(ctx, game, gameInfo, msg, whiteConn, blackConn)
	if !valid {
		if resultType == TIME_MISMATCH {
			return GameSendMessage{TYPE: resultType, GameId: msg.GameId, BlackTime: gameInfo.BlackTime, WhiteTime: gameInfo.WhiteTime}, nil
		}
		return GameSendMessage{TYPE: resultType, GameId: msg.GameId}, nil
	}
	if resultType == DECLARE_RESULT {
		return nil, nil
	}
	return GameSendMessage{TYPE: MAKE_MOVE, GameId: msg.GameId, FEN: game.FEN()}, nil
}

// offerDraw takes a context and draw-offer message, validates the game participant, stores
// the pending offer, and notifies the opponent. It returns an acceptance or rejection message.
func offerDraw(ctx context.Context, msg GameReceiveMessage) (any, error) {
	_, gameInfo, err := getGame(msg.GameId)
	if err != nil {
		return nil, err
	}
	if msg.Username != gameInfo.WhiteId && msg.Username != gameInfo.BlackId {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}, nil
	}
	opponent := gameInfo.WhiteId
	if opponent == msg.Username {
		opponent = gameInfo.BlackId
	}
	opponentConn, ok := getConn(opponent)
	if !ok {
		return GameSendMessage{TYPE: REJECT, GameId: msg.GameId}, nil
	}
	if err := set_redis_key(string(DRAW_REQUEST)+opponent, msg.Username, 0); err != nil {
		return nil, err
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: OFFER_DRAW, GameId: msg.GameId}); err != nil {
		_ = deleteRedisKey(string(DRAW_REQUEST) + opponent)
		return nil, err
	}
	return GameSendMessage{TYPE: ACCEPT, GameId: msg.GameId}, nil
}

// resignGame takes a context and resignation message, verifies the player and game, notifies
// the opponent of the winning color, ends the game, and returns the result message.
func resignGame(ctx context.Context, msg GameReceiveMessage) (any, error) {
	_, gameInfo, err := getGame(msg.GameId)
	if err != nil {
		return nil, err
	}
	if msg.Username != gameInfo.WhiteId && msg.Username != gameInfo.BlackId {
		return nil, fmt.Errorf("Not Authorized")
	}
	opponent := gameInfo.WhiteId
	if opponent == msg.Username {
		opponent = gameInfo.BlackId
	}
	opponentConn, ok := getConn(opponent)
	if !ok {
		return nil, fmt.Errorf("Internal Error")
	}
	winnerColor := WHITE
	if opponent == gameInfo.BlackId {
		winnerColor = BLACK
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: RESIGN_GAME, GameId: msg.GameId, Winner: winnerColor}); err != nil {
		return nil, err
	}
	if err := transitionPlayerStatus(msg.Username, ONLINE); err != nil {
		return nil, fmt.Errorf("Could not update resigning player status: %v", err)
	}
	if err := transitionPlayerStatus(opponent, ONLINE); err != nil {
		return nil, fmt.Errorf("Could not update opponent status after resignation: %v", err)
	}
	removeGameRecord(ctx, gameInfo)
	return GameSendMessage{TYPE: RESIGN_GAME, GameId: msg.GameId, Winner: winnerColor}, nil
}

// acceptDraw takes a context and draw-response message, notifies the offerer, marks both
// players available, removes the ended game, and returns the draw result or rejection.
func acceptDraw(ctx context.Context, msg GameReceiveMessage) (any, error) {
	requester, err := getRedisKey(string(DRAW_REQUEST) + msg.Username)
	if err != nil {
		return nil, err
	}
	_, gameInfo, err := getGame(msg.GameId)
	if err != nil || (msg.Username != gameInfo.WhiteId && msg.Username != gameInfo.BlackId) {
		return nil, fmt.Errorf("Not Authorized for this action")
	}
	opponentConn, ok := getConn(requester)
	if !ok {
		return nil, fmt.Errorf("Internal Error")
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: ACCEPT_DRAW_REQUEST, GameId: msg.GameId}); err != nil {
		return nil, err
	}
	_ = deleteRedisKey(string(DRAW_REQUEST) + msg.Username)
	if err := transitionPlayerStatus(msg.Username, ONLINE); err != nil {
		return nil, fmt.Errorf("Could not update accepting player's status after draw: %v", err)
	}
	if err := transitionPlayerStatus(requester, ONLINE); err != nil {
		return nil, fmt.Errorf("Could not update offering player's status after draw: %v", err)
	}
	removeGameRecord(ctx, gameInfo)
	return GameSendMessage{TYPE: ACCEPT_DRAW_REQUEST, GameId: msg.GameId}, nil
}

// rejectDraw takes a context and draw-response message, notifies the offerer, clears the
// pending request, and returns the draw-rejection message.
func rejectDraw(ctx context.Context, msg GameReceiveMessage) (any, error) {
	requester, err := getRedisKey(string(DRAW_REQUEST) + msg.Username)
	if err != nil {
		return nil, err
	}
	opponentConn, ok := getConn(requester)
	if !ok {
		return nil, fmt.Errorf("Internal Error")
	}
	if err := writeWSMessage(ctx, opponentConn, GameSendMessage{TYPE: REJECT_DRAW_REQUEST, GameId: msg.GameId}); err != nil {
		return nil, err
	}
	_ = deleteRedisKey(string(DRAW_REQUEST) + msg.Username)
	return GameSendMessage{TYPE: ACCEPT, GameId: msg.GameId}, nil
}

func canTransition(from, to MESSAGE_TYPE) bool {
	switch from {
	case MESSAGE_TYPE(""):
		return slices.Contains([]MESSAGE_TYPE{ONLINE}, to)
	case ONLINE:
		return slices.Contains([]MESSAGE_TYPE{READY_FOR_GAME}, to)
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

// transitionPlayerStatus takes a username and requested status, validates the current Redis
// status against canTransition function, and stores the new status. It returns a Redis or transition error.
func transitionPlayerStatus(username string, requestedStatus MESSAGE_TYPE) error {
	currentValue, err := getRedisKey(PLAYER_STATUS + username)
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}
	currentStatus := MESSAGE_TYPE(currentValue)
	if currentStatus == requestedStatus {
		return &game_error{error_code: ALREADY_IN_STATE}
	}
	if canTransition(currentStatus, requestedStatus) {
		err := set_redis_key(PLAYER_STATUS+username, string(requestedStatus), 0)
		if err != nil {
			log.Printf("Error while setting redis key %q", err.Error())
			return &game_error{error_code: INTERNAL_SERVER_ERROR}
		} else {
			return nil
		}
	}
	return &game_error{error_code: INVALID_STATE_TRANSITION}
}
