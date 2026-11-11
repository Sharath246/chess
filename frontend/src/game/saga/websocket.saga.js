import {
  fork,
  take,
  takeLatest,
  put,
  cancel,
  cancelled,
  actionChannel,
  all,
  select,
} from "redux-saga/effects";
import {
  setWebsocketReceivedMessages,
  setWebsocketSentMessages,
  websocketConnectionClose,
  websocketConnectionFail,
  websocketConnectionStart,
  websocketConnectionSuccess,
  setPlayerStatus,
  clearPlayerStatus,
} from "../reducers/websocket.reducer";
import {
  SEND_WEBSOCKET_MESSAGE,
  ONLINE,
  PAIRED,
  STATUS_SUCCESS,
  WEBSOCKET_CLOSE,
  WEBSOCKET_ERROR,
  WEBSOCKET_MESSAGE_RECEIVED,
  WEBSOCKET_OPEN,
  MAKE_MOVE,
  REQUEST_GAME,
  ACCEPT_GAME_REQUEST,
  REJECT_GAME_REQUEST,
  PLAYER_NOT_AVAILABLE,
  OFFER_DRAW,
  ACCEPT_DRAW_REQUEST,
  REJECT_DRAW_REQUEST,
  RESIGN_GAME,
  DECLARE_RESULT,
  START_GAME,
} from "../../utils/constants";
import { eventChannel, buffers } from "redux-saga";
import { GAME_WEBSOCKET_URL } from "../../utils/url";
import { addGameRequest, initiateGame, removeGameRequest, removeOutgoingGameRequest, setDrawOffer, setGameUsingFEN, setOnlineNotice, setOnlineResult, terminateGame } from "../reducers/game.reducer";
import { canTransitionPlayerStatus, validateIncomingPlayerMessage, validateOutgoingPlayerMessage } from "../player-state-machine";

function createWebsocketChannel(sessionId) {
  const tabId = sessionStorage.getItem('tabId') || crypto.randomUUID();
  sessionStorage.setItem('tabId', tabId);

  const socket = new WebSocket(GAME_WEBSOCKET_URL(tabId, sessionId));

  const channel = eventChannel((emitter) => {
    socket.onopen = () => emitter({ type: WEBSOCKET_OPEN });
    socket.onclose = () => {
      console.log("closing connection");
      emitter({ type: WEBSOCKET_CLOSE })
    };
    socket.onerror = () => emitter({ type: WEBSOCKET_ERROR });
    socket.onmessage = (event) => emitter({ type: WEBSOCKET_MESSAGE_RECEIVED, message: event.data });

    const unsubscribe = () => {
      socket.close()
      console.log('unsubscribed')
    };
    return unsubscribe;
  }, buffers.expanding());

  return { socket, channel };
}

function handleMessage(event) {
  return JSON.parse(event.message);
}

function* handleEventListeners(channel) {
  try {
    while (true) {
      const event = yield take(channel);

      switch (event.type) {
        case WEBSOCKET_OPEN:
          {
            const currentStatus = yield select((state) => state.websocket.playerStatus);
            if (canTransitionPlayerStatus(currentStatus, ONLINE)) {
              yield put(setPlayerStatus(ONLINE));
            } else {
              console.warn(`Rejected player status transition: ${currentStatus} -> ${ONLINE}`);
            }
          }
          yield put(websocketConnectionSuccess());
          break;

        case WEBSOCKET_MESSAGE_RECEIVED:
          {
            const message = handleMessage(event);
            const currentStatus = yield select((state) => state.websocket.playerStatus);
            const validation = validateIncomingPlayerMessage(message, currentStatus);
            if (!validation.valid) {
              console.warn(`Ignored ${message.type} while player status is ${currentStatus}`);
              continue;
            }
            if (validation.nextStatus && validation.nextStatus !== currentStatus) {
              yield put(setPlayerStatus(validation.nextStatus));
            }
            yield put(setWebsocketReceivedMessages(message));

            if (message.type === REQUEST_GAME && message.opponentUsername) {
              yield put(addGameRequest(message.opponentUsername));
            }

            if (message.type === ACCEPT_GAME_REQUEST && message.opponentUsername) {
              yield put(removeGameRequest(message.opponentUsername));
            }

            if ([REJECT_GAME_REQUEST, PLAYER_NOT_AVAILABLE].includes(message.type) && message.opponentUsername) {
              yield put(removeGameRequest(message.opponentUsername));
              yield put(removeOutgoingGameRequest(message.opponentUsername));
            }

            if (message.type === PAIRED && message.opponentUsername) {
              yield put(removeGameRequest(message.opponentUsername));
              yield put(removeOutgoingGameRequest(message.opponentUsername));
            }

            if (message.type === OFFER_DRAW) {
              yield put(setDrawOffer(true));
            }

            if (message.type === ACCEPT_DRAW_REQUEST) {
              yield put(setDrawOffer(false));
              yield put(setOnlineResult({ title: "Draw agreed", winner: null }));
            }

            if (message.type === REJECT_DRAW_REQUEST) {
              yield put(setDrawOffer(false));
              yield put(setOnlineNotice("Draw request declined"));
            }

            if (message.type === RESIGN_GAME) {
              const winner = message.winner === "white"
                ? "w"
                : message.winner === "black"
                  ? "b"
                  : "opponent";
              yield put(setOnlineResult({ title: "Resignation", winner }));
            }

            if (message.type === DECLARE_RESULT) {
              const winner = message.winner === "white"
                ? "w"
                : message.winner === "black"
                  ? "b"
                  : null;
              yield put(setOnlineResult({ title: message.result || "Game complete", winner }));
            }

            if (message.type === START_GAME) {
              yield put(initiateGame(message));
              yield put(setGameUsingFEN(message.fen));
            } 
            else if ((message.type === MAKE_MOVE || message.type === DECLARE_RESULT) && message.fen) {
              yield put(setGameUsingFEN(message.fen));
            }
          }
          break;

        case WEBSOCKET_CLOSE:
          console.log("closed connection")
          yield put(clearPlayerStatus());
          yield put(websocketConnectionClose())
          return;
        case WEBSOCKET_ERROR:
          yield put(clearPlayerStatus());
          yield put(websocketConnectionClose());
          yield put(terminateGame())
          return; // stop loop
        default:
          break;
      }
    }
  } finally {
    if (yield cancelled()) {
      // optional cleanup
    }
  }
}


function* handleSendMessages(socket, channel) {
  try {
    while (true) {
      const action = yield take(channel);
      const payload = JSON.stringify(action.payload);
      console.log(action.payload)
      if (socket.readyState === WebSocket.OPEN) {
        const currentStatus = yield select((state) => state.websocket.playerStatus);
        const validation = validateOutgoingPlayerMessage(action.payload, currentStatus);
        if (!validation.valid) {
          console.warn(`Rejected outgoing ${action.payload.type} while player status is ${currentStatus}`);
          continue;
        }
        socket.send(payload);
        if (validation.nextStatus) {
          yield put(setPlayerStatus(validation.nextStatus));
        }
        yield put(setWebsocketSentMessages(JSON.parse(payload)));
      } else {
        // queue or drop depending on strategy
      }
    }
  } finally {
    if (yield cancelled()) {
      // optional cleanup
    }
  }
}


function* create_websocket_connection() {
  try {
    const connection = yield select((state) => state.websocket.websocket_connect_status)
    
    if(connection === STATUS_SUCCESS)
        return;

    const sessionId = yield select((state) => state.websocket.sessionId);
    const { socket, channel: wsChannel } = createWebsocketChannel(sessionId);

    // Queue up SEND actions
    const sendChannel = yield actionChannel(SEND_WEBSOCKET_MESSAGE, buffers.expanding());

    // Start listeners
    const listenerTask = yield fork(handleEventListeners, wsChannel);
    const senderTask = yield fork(handleSendMessages, socket, sendChannel);

    // Wait for socket close
    yield take(websocketConnectionClose.type);

    // Cleanup
    yield cancel(listenerTask);
    yield cancel(senderTask);
  } catch (error) {
    yield put(websocketConnectionFail(error));
  }
}

export default function* websocketSaga() {
  yield all([
    takeLatest(websocketConnectionStart.type, create_websocket_connection),
  ]);
}
