
export const API_URL = "http://localhost:8080";

export const GAME_WEBSOCKET_URL = (tabId, sessionId) =>
	`ws://localhost:8080/play-game/${tabId}?sessionId=${encodeURIComponent(sessionId)}`;