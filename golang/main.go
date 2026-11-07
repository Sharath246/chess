package main

import (
	"flag"
	"log"
	"net/http"
	"sync"

	"github.com/coder/websocket"
)

var testingMode bool

var (
	player_conn_info = make(map[string]*websocket.Conn)
	playerConnMutex  sync.RWMutex
)

// corsMiddleware takes the next HTTP handler, adds CORS headers, and handles preflight
// requests. It returns an HTTP handler that delegates allowed non-preflight requests.
func corsMiddleware(next http.Handler) http.Handler {
	allowedOrigins := map[string]bool{
		"http://localhost:3000": true,
		"http://localhost:3001": true,
		"http://localhost:3002": true,
		"http://127.0.0.1:3000": true,
		"http://127.0.0.1:3001": true,
		"http://127.0.0.1:3002": true,
	}

	// The returned handler takes an HTTP writer and request, then either writes a preflight
	// response or passes the request to next; it produces no Go return value.
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == http.MethodOptions {
			if allowedOrigins[origin] {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// chessWebsocket takes an HTTP writer and request, authenticates and upgrades the request,
// then reads and dispatches messages until the connection ends. It writes HTTP/WebSocket
// responses and returns no Go value.
func chessWebsocket(w http.ResponseWriter, r *http.Request) {
	username, ok := usernameFromRequest(r)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "valid session required")
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})

	if err != nil {
		log.Printf("Failed to accept connection: %v", err)
		return
	}
	defer conn.CloseNow()

	game_connection(username, conn, r.Context())
}

// getConn takes a username and returns its current WebSocket connection and
// a boolean indicating whether that connection is registered.
func getConn(username string) (*websocket.Conn, bool) {
	playerConnMutex.RLock()
	defer playerConnMutex.RUnlock()
	conn, ok := player_conn_info[username]
	return conn, ok
}

// get_player_conn_info takes an unused username and returns a slice containing the usernames
// with registered WebSocket connections.
func get_player_conn_info(_ string) []string {
	playerConnMutex.RLock()
	defer playerConnMutex.RUnlock()
	players := make([]string, 0, len(player_conn_info))
	for username := range player_conn_info {
		players = append(players, username)
	}
	return players
}

// mark_online takes an HTTP writer and authenticated request, marks the player online in
// Redis, and writes the current player list or a JSON error response. It returns no Go value.
func mark_online(w http.ResponseWriter, r *http.Request) {
	username, _ := usernameFromRequest(r)
	if err := transitionPlayerStatus(username, ONLINE); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "could not mark user online")
		return
	}
	writeJSON(w, http.StatusOK, get_player_conn_info(username))
}

// get_online takes an HTTP writer and authenticated request, then writes the connected player
// usernames as JSON. It returns no Go value.
func get_online(w http.ResponseWriter, r *http.Request) {
	username, _ := usernameFromRequest(r)
	writeJSON(w, http.StatusOK, get_player_conn_info(username))
}

// main parses backend flags, initializes Redis and game state, registers HTTP routes, and
// serves the API and WebSocket endpoint on port 8080. It takes no arguments or return values.
func main() {
	flag.BoolVar(&testingMode, "testing", false, "bypass authentication for local testing")
	flag.Parse()

	redis_main()
	websocket_main()

	mux := http.NewServeMux()
	mux.HandleFunc("POST /register_user", register_user)
	mux.HandleFunc("POST /login", login_user)
	mux.HandleFunc("POST /guest_login", guest_login)
	mux.HandleFunc("POST /post_online", withAuthentication(mark_online))
	mux.HandleFunc("GET /get_online", withAuthentication(get_online))
	mux.HandleFunc("GET /play-game", withAuthentication(chessWebsocket))

	if err := http.ListenAndServe(":8080", corsMiddleware(mux)); err != nil {
		log.Fatal("Server error:", err)
	}
}
