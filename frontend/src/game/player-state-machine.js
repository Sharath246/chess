import {
  ACCEPT_DRAW_REQUEST,
  ACCEPT_GAME_REQUEST,
  DECLARE_RESULT,
  MAKE_MOVE,
  ONLINE,
  OFFER_DRAW,
  PAIRED,
  PLAYER_NOT_AVAILABLE,
  PLAYING_GAME,
  READY_FOR_GAME,
  REJECT_DRAW_REQUEST,
  REJECT_GAME_REQUEST,
  REQUEST_GAME,
  RESIGN_GAME,
  START_GAME,
} from "../utils/constants";

const previousStatuses = {
  [ONLINE]: ["", ONLINE, PLAYING_GAME],
  [READY_FOR_GAME]: [ONLINE, REQUEST_GAME],
  [REQUEST_GAME]: [READY_FOR_GAME],
  [PAIRED]: [READY_FOR_GAME, REQUEST_GAME],
  [PLAYING_GAME]: [PAIRED],
};

export function canTransitionPlayerStatus(currentStatus, requestedStatus) {
  return previousStatuses[requestedStatus]?.includes(currentStatus) || false;
}

export function validateOutgoingPlayerMessage(message, currentStatus) {
  let nextStatus;
  let requiredStatus;

  switch (message.type) {
    case READY_FOR_GAME:
      nextStatus = READY_FOR_GAME;
      break;
    case REQUEST_GAME:
      nextStatus = REQUEST_GAME;
      break;
    case ACCEPT_GAME_REQUEST:
    case REJECT_GAME_REQUEST:
      requiredStatus = READY_FOR_GAME;
      break;
    case MAKE_MOVE:
    case OFFER_DRAW:
    case ACCEPT_DRAW_REQUEST:
    case REJECT_DRAW_REQUEST:
    case RESIGN_GAME:
      requiredStatus = PLAYING_GAME;
      break;
    default:
      return { valid: true };
  }

  if (requiredStatus && currentStatus !== requiredStatus) {
    return { valid: false };
  }
  if (nextStatus && !canTransitionPlayerStatus(currentStatus, nextStatus)) {
    return { valid: false };
  }

  return { valid: true, nextStatus };
}

export function validateIncomingPlayerMessage(message, currentStatus) {
  switch (message.type) {
    case REQUEST_GAME:
      return { valid: currentStatus === READY_FOR_GAME };
    case ACCEPT_GAME_REQUEST:
      return { valid: [READY_FOR_GAME, REQUEST_GAME].includes(currentStatus) };
    case REJECT_GAME_REQUEST:
    case PLAYER_NOT_AVAILABLE:
      if (currentStatus === REQUEST_GAME) {
        return { valid: true, nextStatus: READY_FOR_GAME };
      }
      return { valid: currentStatus === READY_FOR_GAME };
    case PAIRED:
      return {
        valid: canTransitionPlayerStatus(currentStatus, PAIRED),
        nextStatus: PAIRED,
      };
    case START_GAME:
      return {
        valid: canTransitionPlayerStatus(currentStatus, PLAYING_GAME),
        nextStatus: PLAYING_GAME,
      };
    case MAKE_MOVE:
    case OFFER_DRAW:
    case REJECT_DRAW_REQUEST:
      return { valid: currentStatus === PLAYING_GAME };
    case DECLARE_RESULT:
    case RESIGN_GAME:
    case ACCEPT_DRAW_REQUEST:
      return {
        valid: canTransitionPlayerStatus(currentStatus, ONLINE),
        nextStatus: ONLINE,
      };
    default:
      return { valid: true };
  }
}
