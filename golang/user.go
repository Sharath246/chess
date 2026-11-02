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

// register_user takes an HTTP writer and registration request, validates the supplied
// username/email and password, stores the account, and creates a session. It writes a JSON
// user response on success or a JSON error response and returns no Go value.
func register_user(w http.ResponseWriter, r *http.Request) {
	var credentials userCredentials
	if !decodeJSON(w, r, &credentials) {
		return
	}

	email := strings.ToLower(strings.TrimSpace(credentials.Email))
	requestedUsername := strings.ToLower(strings.TrimSpace(credentials.Username))
	if email == "" && requestedUsername == "" {
		writeJSONError(w, http.StatusBadRequest, "a username or email is required")
		return
	}
	if email != "" && !strings.Contains(email, "@") {
		writeJSONError(w, http.StatusBadRequest, "provide a valid email address")
		return
	}
	if requestedUsername != "" && !validUsername(requestedUsername) {
		writeJSONError(w, http.StatusBadRequest, "username must be 3 to 20 characters using letters, numbers, or underscores")
		return
	}
	if len(credentials.Password) < 8 {
		writeJSONError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(credentials.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	var username, usernameKey string
	usernameClaimKey := ""
	if requestedUsername == "" {
		username, usernameKey, err = reserveUsername()
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "could not create username")
			return
		}
		usernameClaimKey = "user:username:claim:" + username
	} else {
		username = requestedUsername
		usernameKey = "user:username:" + username
		usernameClaimKey = "user:username:claim:" + username
		claimed, claimErr := rdb.SetNX(ctx, usernameClaimKey, "reserved", 0).Result()
		if claimErr != nil {
			writeJSONError(w, http.StatusInternalServerError, "could not create user")
			return
		}
		if !claimed {
			writeJSONError(w, http.StatusConflict, "username is already registered")
			return
		}
	}

	emailKey := ""
	if email != "" {
		emailKey = "user:email:" + email
		claimed, claimErr := rdb.SetNX(ctx, emailKey, "pending", 0).Result()
		if claimErr != nil {
			_ = rdb.Del(ctx, usernameClaimKey).Err()
			writeJSONError(w, http.StatusInternalServerError, "could not create user")
			return
		}
		if !claimed {
			_ = rdb.Del(ctx, usernameClaimKey).Err()
			writeJSONError(w, http.StatusConflict, "email is already registered")
			return
		}
	}

	userFields := []any{"password_hash", string(passwordHash)}
	if email != "" {
		userFields = append(userFields, "email", email)
	}
	if err := rdb.HSet(ctx, usernameKey, userFields...).Err(); err != nil {
		if emailKey != "" {
			_ = rdb.Del(ctx, emailKey).Err()
		}
		_ = rdb.Del(ctx, usernameClaimKey).Err()
		writeJSONError(w, http.StatusInternalServerError, "could not create user")
		return
	}
	if emailKey != "" {
		if err := rdb.Set(ctx, emailKey, username, 0).Err(); err != nil {
			_ = rdb.Del(ctx, emailKey, usernameKey, usernameClaimKey).Err()
			writeJSONError(w, http.StatusInternalServerError, "could not create user")
			return
		}
	}

	sessionID, err := createSession(username, false)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "user created but session could not be created")
		return
	}
	writeJSON(w, http.StatusCreated, userResponse{Username: username, SessionID: sessionID})
}

// login_user takes an HTTP writer and login request, verifies an email or username with the
// supplied password, and creates a session. It writes a JSON user response or JSON error and
// returns no Go value.
func login_user(w http.ResponseWriter, r *http.Request) {
	var credentials userCredentials
	if !decodeJSON(w, r, &credentials) || credentials.Password == "" || (credentials.Username == "" && credentials.Email == "") {
		writeJSONError(w, http.StatusBadRequest, "username or email and password are required")
		return
	}

	username := strings.ToLower(strings.TrimSpace(credentials.Username))
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

// validUsername takes a username and returns whether it is 3–20 lowercase ASCII letters,
// digits, or underscores.
func validUsername(username string) bool {
	if len(username) < 3 || len(username) > 20 {
		return false
	}
	for _, char := range username {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '_' {
			return false
		}
	}
	return true
}

// guest_login takes an HTTP writer and request, reserves a guest username, and creates a
// short-lived guest session. It writes the guest user response or a JSON error and returns no
// Go value.
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

// reserveUsername takes an optional username prefix and reserves a unique generated username.
// It returns the username, its Redis user key, and any Redis or reservation error.
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

// createSession takes a username and guest flag, generates a random session token, and stores
// it with the session lifetime. It returns the token and any generation or Redis error.
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

// decodeJSON takes an HTTP writer, request, and destination value, decodes the request body
// into that value, and returns true on success. On failure it writes a JSON error and returns
// false.
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

// writeJSON takes an HTTP writer, status code, and value, then encodes the value as a JSON
// response. It returns no Go value; encoding failures are ignored.
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// writeJSONError takes an HTTP writer, status code, and message, then writes the message in a
// JSON error object. It returns no Go value.
func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// withAuthentication takes an HTTP handler and returns a wrapper that authenticates requests
// before calling it, or writes an unauthorized JSON response.
func withAuthentication(next http.HandlerFunc) http.HandlerFunc {
	// The returned handler takes an HTTP writer and request, adds the verified username to the
	// request context, and calls next; it writes an error response when authentication fails.
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

// testingUsername takes an HTTP request and returns the test username from its header or query,
// falling back to a fixed testing identity.
func testingUsername(r *http.Request) string {
	if username := strings.TrimSpace(r.Header.Get("X-Test-Username")); username != "" {
		return username
	}
	if username := strings.TrimSpace(r.URL.Query().Get("username")); username != "" {
		return username
	}
	return "testing_user"
}

// authenticatedUsername takes an HTTP request, resolves its bearer token or WebSocket query
// token through Redis, and returns the associated username and an authentication-success flag.
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

// usernameFromRequest takes an HTTP request and returns the username stored in its context and
// a boolean indicating whether a non-empty username was present.
func usernameFromRequest(r *http.Request) (string, bool) {
	username, ok := r.Context().Value(usernameContextKey{}).(string)
	return username, ok && username != ""
}
