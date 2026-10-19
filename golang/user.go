package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

const userSessionTTL = 24 * time.Hour

type usernameContextKey struct{}

type userCredentials struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type userResponse struct {
	Username  string `json:"username"`
	SessionID string `json:"sessionId"`
	IsGuest   bool   `json:"isGuest"`
}

func register_user(w http.ResponseWriter, r *http.Request) {
	var credentials userCredentials
	if !decodeJSON(w, r, &credentials) || credentials.Email == "" || credentials.Password == "" {
		writeJSONError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	email := strings.ToLower(strings.TrimSpace(credentials.Email))
	if !strings.Contains(email, "@") || len(credentials.Password) < 8 {
		writeJSONError(w, http.StatusBadRequest, "provide a valid email and a password of at least 8 characters")
		return
	}

	emailKey := "user:email:" + email
	claimed, err := rdb.SetNX(ctx, emailKey, "pending", 0).Result()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "could not create user")
		return
	}
	if !claimed {
		writeJSONError(w, http.StatusConflict, "email is already registered")
		return
	}

	username, usernameKey, err := reserveUsername()
	if err != nil {
		_ = rdb.Del(ctx, emailKey).Err()
		writeJSONError(w, http.StatusInternalServerError, "could not create username")
		return
	}
	if err := rdb.Set(ctx, emailKey, username, 0).Err(); err != nil {
		_ = rdb.Del(ctx, emailKey, "user:username:claim:"+username).Err()
		writeJSONError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(credentials.Password), bcrypt.DefaultCost)
	if err != nil {
		_ = rdb.Del(ctx, emailKey).Err()
		_ = rdb.Del(ctx, "user:username:claim:"+username).Err()
		writeJSONError(w, http.StatusInternalServerError, "could not create user")
		return
	}
	if err := rdb.HSet(ctx, usernameKey, "email", email, "password_hash", string(passwordHash)).Err(); err != nil {
		_ = rdb.Del(ctx, emailKey).Err()
		_ = rdb.Del(ctx, "user:username:claim:"+username).Err()
		writeJSONError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	sessionID, err := createSession(username, false)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "user created but session could not be created")
		return
	}
	writeJSON(w, http.StatusCreated, userResponse{Username: username, SessionID: sessionID})
}

func login_user(w http.ResponseWriter, r *http.Request) {
	var credentials userCredentials
	if !decodeJSON(w, r, &credentials) || credentials.Password == "" || (credentials.Username == "" && credentials.Email == "") {
		writeJSONError(w, http.StatusBadRequest, "username or email and password are required")
		return
	}

	username := strings.TrimSpace(credentials.Username)
	if username == "" {
		var err error
		username, err = rdb.Get(ctx, "user:email:"+strings.ToLower(strings.TrimSpace(credentials.Email))).Result()
		if errors.Is(err, redis.Nil) {
			writeJSONError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "could not authenticate user")
			return
		}
	}

	passwordHash, err := rdb.HGet(ctx, "user:username:"+username, "password_hash").Result()
	if errors.Is(err, redis.Nil) {
		writeJSONError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil || bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(credentials.Password)) != nil {
		writeJSONError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	sessionID, err := createSession(username, false)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "could not create session")
		return
	}
	writeJSON(w, http.StatusOK, userResponse{Username: username, SessionID: sessionID})
}

func guest_login(w http.ResponseWriter, r *http.Request) {
	username, _, err := reserveUsername("guest")
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "could not create guest username")
		return
	}
	sessionID, err := createSession(username, true)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "could not create guest session")
		return
	}
	writeJSON(w, http.StatusOK, userResponse{Username: username, SessionID: sessionID, IsGuest: true})
}

func reserveUsername(prefix ...string) (string, string, error) {
	namePrefix := "user"
	if len(prefix) > 0 {
		namePrefix = prefix[0]
	}
	for attempts := 0; attempts < 10; attempts++ {
		username := namePrefix + "_" + uuid.NewString()[:8]
		claimKey := "user:username:claim:" + username
		claimed, err := rdb.SetNX(ctx, claimKey, "reserved", 0).Result()
		if err != nil {
			return "", "", err
		}
		if claimed {
			return username, "user:username:" + username, nil
		}
	}
	return "", "", errors.New("could not reserve a unique username")
}

func createSession(username string, guest bool) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	sessionID := hex.EncodeToString(tokenBytes)
	sessionValue := username
	if guest {
		sessionValue = "guest:" + username
	}
	return sessionID, rdb.Set(ctx, "session:"+sessionID, sessionValue, userSessionTTL).Err()
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func withAuthentication(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if testingMode {
			username := testingUsername(r)
			next(w, r.WithContext(context.WithValue(r.Context(), usernameContextKey{}, username)))
			return
		}

		username, ok := authenticatedUsername(r)
		if !ok {
			writeJSONError(w, http.StatusUnauthorized, "valid session required")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), usernameContextKey{}, username)))
	}
}

func testingUsername(r *http.Request) string {
	if username := strings.TrimSpace(r.Header.Get("X-Test-Username")); username != "" {
		return username
	}
	if username := strings.TrimSpace(r.URL.Query().Get("username")); username != "" {
		return username
	}
	return "testing_user"
}

func authenticatedUsername(r *http.Request) (string, bool) {
	const bearerPrefix = "Bearer "
	authorization := r.Header.Get("Authorization")
	sessionID := strings.TrimSpace(strings.TrimPrefix(authorization, bearerPrefix))
	if sessionID == authorization {
		// Browsers cannot set Authorization headers on native WebSocket handshakes.
		sessionID = strings.TrimSpace(r.URL.Query().Get("sessionId"))
	}
	if sessionID == "" {
		return "", false
	}
	sessionValue, err := rdb.Get(ctx, "session:"+sessionID).Result()
	if err != nil {
		return "", false
	}
	return strings.TrimPrefix(sessionValue, "guest:"), true
}

func usernameFromRequest(r *http.Request) (string, bool) {
	username, ok := r.Context().Value(usernameContextKey{}).(string)
	return username, ok && username != ""
}
