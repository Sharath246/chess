### READY_FOR_GAME
Sent by:   a user in status ONLINE
Fields:    username

Success:
1. sender receives → { type: ACCEPT }
Status: sender ONLINE → READY_FOR_GAME

Failures:
1. already ready for game → sender gets { type: REJECT }
2. sender not ONLINE → sender gets { type: REJECT }
3. internal error → sender gets { type: INTERNAL_ERROR }

### REQUEST_GAME
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: username, targetusername

Success:
1. sender receives → { type: ACCEPT }
2. target receives -> { type: REQUEST_GAME, username: sender }
Status: sender, target unchanged.

Failures:
1. sender/target not READY_FOR_GAME -> sender gets { type: REJECT }
2. internal error → sender gets { type: INTERNAL_ERROR }

### ACCEPT_GAME_REQUEST
Sent by:   a user in status READY_FOR_GAME
Target: a user in status READY_FOR_GAME
Fields: username, targetusername

Success:
1. sender receives → { type: PAIRED, targetUsername }
2. target receives -> { type: PAIRED, targetUsername }
Status: sender, target status changed to PAIRED.

Failures:
1. sender/target not READY_FOR_GAME -> sender gets { type: REJECT }
3. internal error → sender gets { type: INTERNAL_ERROR }

