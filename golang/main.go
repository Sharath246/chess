package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

var testingMode bool

var (
	player_conn_info = make(map[string]*websocket.Conn)
	playerConnMutex  sync.RWMutex
)

func corsMiddleware(next http.Handler) http.Handler {
	allowedOrigins := map[string]bool{
		"http://localhost:3000": true,
		"http://localhost:3001": true,
		"http://localhost:3002": true,
		"http://127.0.0.1:3000": true,
		"http://127.0.0.1:3001": true,
		"http://127.0.0.1:3002": true,
	}

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

	playerConnMutex.Lock()
	player_conn_info[username] = conn
	playerConnMutex.Unlock()
	if err := set_redis_key(PLAYER_STATUS+username, string(ONLINE), 0); err != nil {
		close_connection(conn)
		return
	}
	defer func() {
		playerConnMutex.Lock()
		if player_conn_info[username] == conn {
			delete(player_conn_info, username)
		}
		playerConnMutex.Unlock()
		_ = delete_redis_key(PLAYER_STATUS + username)
	}()

	fmt.Println("Client connected:", username)
	for {
		var rawMessage json.RawMessage
		readCtx, cancel := context.WithCancel(r.Context())
		err := wsjson.Read(readCtx, conn, &rawMessage)
		cancel()
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
				fmt.Println("Client disconnected normally.")
				return
			}
			log.Printf("Read error: %v", err)
			return
		}

		readMsg, err := decodeWebSocketMessage(rawMessage)
		if err != nil {
			log.Printf("Invalid message: %v", err)
			_ = writeWSMessage(r.Context(), conn, PlayerMessage{TYPE: REJECT})
			continue
		}

		writeMsg := processMessage(r.Context(), conn, username, readMsg)
		if writeMsg != nil {
			if err := writeWSMessage(r.Context(), conn, writeMsg); err != nil {
				close_connection(conn)
				return
			}
		}
	}
}

func get_player_connection(username string) (*websocket.Conn, bool) {
	playerConnMutex.RLock()
	defer playerConnMutex.RUnlock()
	conn, ok := player_conn_info[username]
	return conn, ok
}

func get_player_conn_info(_ string) []string {
	playerConnMutex.RLock()
	defer playerConnMutex.RUnlock()
	players := make([]string, 0, len(player_conn_info))
	for username := range player_conn_info {
		players = append(players, username)
	}
	return players
}

func mark_online(w http.ResponseWriter, r *http.Request) {
	username, _ := usernameFromRequest(r)
	if err := set_redis_key(PLAYER_STATUS+username, string(ONLINE), 0); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "could not mark user online")
		return
	}
	writeJSON(w, http.StatusOK, get_player_conn_info(username))
}

func get_online(w http.ResponseWriter, r *http.Request) {
	username, _ := usernameFromRequest(r)
	writeJSON(w, http.StatusOK, get_player_conn_info(username))
}

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
