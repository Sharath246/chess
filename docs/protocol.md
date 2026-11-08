### READY_FOR_GAME
Sent by:   a user in status ONLINE

Success:
- sender receives → { type: ACCEPT}
Status: sender ONLINE → READY_FOR_GAME

Failures:
- already ready for game → sender gets { type: REJECT, username, reason: already_in_state }
- sender not ONLINE → { type: REJECT, username, reason: not_online }
- internal error → sender gets { type: INTERNAL_ERROR, username }
- sender in PAIRED/PLAYING_GAME state → sender gets { type: REJECT, username, reason: previous_state_transition_not_allowed }

### REQUEST_GAME
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: opponentUsername

Success:
- sender receives → { type: ACCEPT, username: sender, opponentUsername: target }
- target receives → { type: REQUEST_GAME, username: target, opponentUsername: sender }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, opponentUsername, reason: not_online, username }
- target not ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: target_not_online}
- sender in state ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: sender_not_ready_for_game }
- target in ONLINE state → sender gets { type: REJECT, username, opponentUsername, reason: target_not_ready_for_game}
- internal error → sender gets { type: INTERNAL_ERROR, username, opponentUsername }

```Note :- We can change these in the future to make sender start multiple games hence start multiple requests```

- sender in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: sender_already_paired } 
- target in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: target_already_paired }
- sender in PLAYING_GAME state → sender gets { type: REJECT, username, gameId, reason: sender_in_game } 
- target in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: target_in_game }

### ACCEPT_GAME_REQUEST
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: opponentUsername

Success:
- sender receives → { type: PAIRED, username: sender, opponentUsername: target } → {TYPE: START_GAME, fen, gameID, color}
- target receives → { type: PAIRED, username: target, opponentUsername: sender } → {TYPE: START_GAME, fen, gameID, color}
Status: sender, target status changed to PAIRED.

Failures:
- sender not ONLINE → { type: REJECT, username, reason: not_online }
- target not ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: target_not_online} ```Any existing Game request will be deleted.```
- sender in state ONLINE → sender gets { type: REJECT, username, reason: sender_not_ready_for_game } ```Any existing Game request will be deleted.```
- target in ONLINE state → sender gets { type: REJECT, username, opponentUsername, reason: target_not_ready_for_game} ```Any existing Game request will be deleted.```
- No such game request made → sender gets { type: REJECT, username, opponentUsername, reason: no_game_request }
- internal error → sender gets { type: INTERNAL_ERROR, username, opponentUsername }

```Note :- We can change these in the future to make sender start multiple games hence start multiple requests```

- sender in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: sender_already_paired } 
- target in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: target_already_paired }
- sender in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: sender_in_game } 
- target in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: target_in_game }

### REJECT_GAME_REQUEST
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: opponentUsername

Success:
- sender receives → { type: ACCEPT, username: sender, opponentUsername: target }
- target receives → { type: REJECT_GAME_REQUEST, username: target, opponentUsername: sender }
Status: sender, target status changed to READY_FOR_GAME.

Failures:
- sender not ONLINE → { type: REJECT, username, opponentUsername, reason: not_online }
- target not ONLINE → sender gets { type: ACCEPT, opponentUsername} ```Any existing Game request will be deleted.```
- sender in state ONLINE → sender gets { type: REJECT, username, opponentUsername, reason: sender_not_ready_for_game } ```Any existing Game request will be deleted.```
- target in ONLINE state → sender gets { type: REJECT, username, opponentUsername, reason: target_not_ready_for_game } ```Any existing Game request will be deleted.```
- No such game request made → sender gets { type: REJECT, username, opponentUsername, reason: no_game_request }
- internal error → sender gets { type: INTERNAL_ERROR, username, opponentUsername }

```Note :- We can change these in the future to make sender start multiple games hence start multiple requests```

- sender in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: sender_already_paired } ```Any existing Game request will be deleted.```
- target in PAIRED state → sender gets { type: REJECT, username, opponentUsername, reason: target_already_paired } ```Any existing Game request will be deleted.```
- sender in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: sender_in_game } ```Any existing Game request will be deleted.```
- target in PLAYING_GAME state → sender gets { type: REJECT, username, opponentUsername, reason: target_in_game } ```Any existing Game request will be deleted.```


### MAKE_MOVE
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId, move, time

Success:
- sender receives → { type: MAKE_MOVE, gameId, fen }
- target receives → { type: MAKE_MOVE, gameId, fen }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: not_online }
- target not ONLINE → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color }
- No such game → sender gets { type: REJECT, username, gameId, reason: no_such_game }
- Invalid Move → sender gets { type: REJECT, username, gameId, reason: invalid_move }
- Invalid time → sender gets { type: REJECT, username, gameId, reason: invalid_time } ```Should finalize the game``` 
- internal error → sender gets { type: INTERNAL_ERROR, username, gameId }

### OFFER_DRAW
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT, gameId }
- target receives → { type: OFFER_DRAW, gameId }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: not_online }
- target not ONLINE → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color }
- No such game → sender gets { type: REJECT, username, gameId, reason: no_such_game } 
- internal error → sender gets { type: INTERNAL_ERROR, username, gameId }

### ACCEPT_DRAW_REQUEST
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT_DRAW_REQUEST, gameId }
- target receives → { type: ACCEPT_DRAW_REQUEST, gameId }
Status: sender, target moved to ONLINE.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: not_online }
- target not ONLINE → sender gets { type: ACCEPT_DRAW_REQUEST, username, gameId }
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: ACCEPT_DRAW_REQUEST, gameId }
- No such game request → sender gets { type: REJECT, username, gameId, reason: no_game_request } 
- internal error → sender gets { type: INTERNAL_ERROR, username, gameId }

### REJECT_DRAW_REQUEST
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT, gameId }
- target receives → { type: REJECT_DRAW_REQUEST, gameId }
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: not_online }
- target not ONLINE → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- No such game request → sender gets { type: REJECT, username, gameId, reason: no_game_request } 
- internal error → sender gets { type: INTERNAL_ERROR, username, gameId }

### RESIGN_GAME
Sent by:   a user in status PLAYING_GAME
Target: a user in status PLAYING_GAME
Fields: gameId

Success:
- sender receives → { type: ACCEPT, gameId }
- target receives → { type: DECLARE_RESULT, fen, gameId, result: RESIGN_GAME, winner: sender's color}
Status: sender, target unchanged.

Failures:
- sender not ONLINE → { type: REJECT, username, gameId, reason: not_online }
- target not ONLINE → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- sender in state ONLINE → sender gets { type: REJECT, username, gameId, reason: sender_not_in_game }
- target in ONLINE state → sender gets { type: DECLARE_RESULT, fen, gameId, result: "Opponent disconnected", winner: sender's color}
- No such game request → sender gets { type: REJECT, username, gameId, reason: no_game_request } 
- internal error → sender gets { type: INTERNAL_ERROR, username, gameId }