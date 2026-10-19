import { all } from "redux-saga/effects";
import websocketSaga from "./game/saga/websocket.saga";

function* rootSaga() {
    yield all([
        websocketSaga()
    ])
}

export default rootSaga;