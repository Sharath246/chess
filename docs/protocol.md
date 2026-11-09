### CONNECT  (event, not a client message)
Trigger:   client opens the WebSocket to /play-game?sessionId=<id> when the player enters the application

Success:
- no message sent            ← client can get the active games he is a part of here.
Status: (none) → ONLINE

Failures:
- missing / invalid / expired session → HTTP 401, WebSocket not opened
- origin not allowed → HTTP 403, WebSocket not opened   (target: origin check is disabled today)
- user already has an open connection (second tab) → UNDECIDED (reject the new one / replace the old one / allow both)
- internal error (status cannot be stored) → socket closed with close code 1011 (internal error)

### DISCONNECT  (event, not a client message)
Trigger:   socket closes (tab closed, network lost, or server closed it)

Effects, by the user's status at the moment of disconnect:
- ONLINE or READY_FOR_GAME → no messages
- pending game requests SENT by the user → each target receives UNDECIDED (so the request disappears from their list)
- pending game requests RECEIVED by the user → each requester receives UNDECIDED
- PAIRED → opponent receives UNDECIDED; opponent status → UNDECIDED
- PLAYING_GAME → opponent receives { type: DECLARE_RESULT, gameId, fen, result: "Opponent disconnected", winner: opponent's color }
                opponent status → ONLINE; game ends; any pending draw offer is discarded
Status: user's status removed

### READY_FOR_GAME
Sent by:   a user in status ONLINE

Success:
- sender receives → { type: ACCEPT}
Status: sender ONLINE → READY_FOR_GAME

Failures:
- already ready for game → sender gets { type: REJECT, username, reason: ALREADY_IN_STATE }
- sender not ONLINE → { type: REJECT, username, reason: NOT_AUTHORIZED }
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username }
- sender in PAIRED/PLAYING_GAME state → sender gets { type: REJECT, username, reason: INVALID_STATE_TRANSITION }

### REQUEST_GAME
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: opponentUsername

Success:
- sender receives → { type: ACCEPT, username: sender, opponentUsername: target }
- target receives → { type: REQUEST_GAME, username: target, opponentUsername: sender }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, opponentUsername, reason: NOT_AUTHORIZED, username }
- target not ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_NOT_ONLINE}
- sender in state ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: NOT_AUTHORIZED }
- target in ONLINE state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_NOT_READY_FOR_GAME}
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, opponentUsername }

```Note :- We can change these in the future to make sender start multiple games hence start multiple requests```

- sender in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: SENDER_ALREADY_PAIRED } 
- target in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_ALREADY_PAIRED }
- sender in PLAYING_GAME state → sender gets { type: REJECT, username, gameId, reason: SENDER_IN_GAME } 
- target in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_IN_GAME }

### ACCEPT_GAME_REQUEST
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: opponentUsername

Success:
- sender receives → { type: PAIRED, username: sender, opponentUsername: target } → {TYPE: START_GAME, fen, gameID, color}
- target receives → { type: PAIRED, username: target, opponentUsername: sender } → {TYPE: START_GAME, fen, gameID, color}
Status: sender, target status changed to PAIRED.

Failures:
- sender not ONLINE → { type: REJECT, username, reason: NOT_AUTHORIZED }
- target not ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_NOT_ONLINE} ```Any existing Game request will be deleted.```
- sender in state ONLINE → sender gets { type: REJECT, username, reason: NOT_AUTHORIZED } ```Any existing Game request will be deleted.```
- target in ONLINE state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_NOT_READY_FOR_GAME} ```Any existing Game request will be deleted.```
- No such game request made → sender gets { type: REJECT, username, opponentUsername, reason: NO_GAME_REQUEST }
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, opponentUsername }

```Note :- We can change these in the future to make sender start multiple games hence start multiple requests```

- sender in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: SENDER_ALREADY_PAIRED } 
- target in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_ALREADY_PAIRED }
- sender in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: SENDER_IN_GAME } 
- target in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_IN_GAME }

### REJECT_GAME_REQUEST
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: opponentUsername

Success:
- sender receives → { type: ACCEPT, username: sender, opponentUsername: target }
- target receives → { type: REJECT_GAME_REQUEST, username: target, opponentUsername: sender }
Status: sender, target status changed to READY_FOR_GAME.

Failures:
- sender not ONLINE → { type: REJECT, username, opponentUsername, reason: NOT_AUTHORIZED }
- target not ONLINE → sender gets { type: ACCEPT, opponentUsername} ```Any existing Game request will be deleted.```
- sender in state ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: NOT_AUTHORIZED } ```Any existing Game request will be deleted.```
- target in ONLINE state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_NOT_READY_FOR_GAME } ```Any existing Game request will be deleted.```
- No such game request made → sender gets { type: REJECT, username, opponentUsername, reason: NO_GAME_REQUEST }
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, opponentUsername }

```Note :- We can change these in the future to make sender start multiple games hence start multiple requests```

- sender in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: SENDER_ALREADY_PAIRED } ```Any existing Game request will be deleted.```
- target in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_ALREADY_PAIRED } ```Any existing Game request will be deleted.```
- sender in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: SENDER_IN_GAME } ```Any existing Game request will be deleted.```
- target in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: TARGET_IN_GAME } ```Any existing Game request will be deleted.```


### MAKE_MOVE
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId, move, time

Success:
- sender receives → { type: MAKE_MOVE, gameId, fen }
- target receives → { type: MAKE_MOVE, gameId, fen }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: NOT_AUTHORIZED }
- target not ONLINE → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color }
- No such game → sender gets { type: REJECT, username, gameId, reason: NO_SUCH_GAME }
- Invalid Move → sender gets { type: REJECT, username, gameId, reason: INVALID_MOVE }
- Invalid time → sender gets { type: REJECT, username, gameId, reason: TIME_ERROR } ```Should finalize the game``` 
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, gameId }

### OFFER_DRAW
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT, gameId }
- target receives → { type: OFFER_DRAW, gameId }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: NOT_AUTHORIZED }
- target not ONLINE → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color }
- No such game → sender gets { type: REJECT, username, gameId, reason: NO_SUCH_GAME } 
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, gameId }

### ACCEPT_DRAW_REQUEST
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT_DRAW_REQUEST, gameId }
- target receives → { type: ACCEPT_DRAW_REQUEST, gameId }
Status: sender, target moved to ONLINE.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: NOT_AUTHORIZED }
- target not ONLINE → sender gets { type: ACCEPT_DRAW_REQUEST, username, gameId }
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: ACCEPT_DRAW_REQUEST, gameId }
- No such game request → sender gets { type: REJECT, username, gameId, reason: NO_GAME_REQUEST } 
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, gameId }

### REJECT_DRAW_REQUEST
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT, gameId }
- target receives → { type: REJECT_DRAW_REQUEST, gameId }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: NOT_AUTHORIZED }
- target not ONLINE → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- No such game request → sender gets { type: REJECT, username, gameId, reason: NO_GAME_REQUEST } 
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, gameId }

### RESIGN_GAME
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT, gameId }
- target receives → { type: DECLARE_RESULT, fen, gameId, result: RESIGN_GAME, winner: sender's color}
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: NOT_AUTHORIZED }
- target not ONLINE → sender,target gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: target's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender, target gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: target's color}
- No such game request → sender gets { type: REJECT, username, gameId, reason: NO_GAME_REQUEST } 
- internal error → sender gets { type: INTERNAL_SERVER_ERROR, username, gameId }