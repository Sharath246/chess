
export const API_URL = "http://localhost:8080";

export const GAME_WEBSOCKET_URL = (sessionId) =>
	`ws://localhost:8080/play-game?sessionId=${encodeURIComponent(sessionId)}`;