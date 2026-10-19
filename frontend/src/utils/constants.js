
export const STATUS_PENDING = "pending";
export const STATUS_FAIL = "fail";
export const STATUS_SUCCESS = "success";
export const STATUS_CLOSED = "closed"
export const SEND_WEBSOCKET_MESSAGE = "send_websocket_message"
export const WEBSOCKET_OPEN = "websocket_open"
export const WEBSOCKET_CLOSE = "websocket_close"
export const WEBSOCKET_MESSAGE_RECEIVED = "websocket_message_received"
export const WEBSOCKET_ERROR = "websocket_error"

export const READY_FOR_GAME = "READY_FOR_GAME";
export const REQUEST_GAME = "REQUEST_GAME";
export const ACCEPT_GAME_REQUEST = "ACCEPT_GAME_REQUEST";
export const REJECT_GAME_REQUEST = "REJECT_GAME_REQUEST";
export const PLAYER_NOT_ONLINE = "PLAYER_NOT_ONLINE";
export const MAKE_MOVE = "MAKE_MOVE";
export const OFFER_DRAW = "OFFER DRAW";
export const ACCEPT_DRAW_REQUEST = "ACCEPT_DRAW_REQUEST";
export const REJECT_DRAW_REQUEST = "REJECT_DRAW_REQUEST";
export const RESIGN_GAME = "RESIGN_GAME";
export const DECLARE_RESULT = "DECLARE_RESULT";

export const WAITING_IN_LOBBY = "WAITING_IN_LOBBY";
export const PLAYING_GAME = "PLAYING_GAME";
export const CONNECTED = "CONNECTED";
export const PLAYERS_LIST = "PLAYERS_LIST";
export const CREATE_NEW_GAME = "CREATE_NEW_GAME";
export const JOIN_NEW_GAME = "JOIN_NEW_GAME";
export const REQUEST_PLAYERS = "REQUEST_PLAYERS";
export const CREATED_GAME = "CREATED_GAME";
export const INITIATE_GAME = "INITIATE_GAME";
export const TERMINATE_GAME = "TERMINATE_GAME";

export const BOTH = "both"
export const WHITE_PLAYER = "white"
export const BLACK_PLAYER = "black"

export const GameMode = {
	LOCAL: "local",
	ONLINE: "online",
};