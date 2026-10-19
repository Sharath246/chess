import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from 'redux-saga'
import rootSaga from "./rootSaga";
import { websocketReducer } from "./game/reducers/websocket.reducer";
import { gameReducer } from "./game/reducers/game.reducer";

const sagaMiddleware = createSagaMiddleware()

export const store = configureStore({
    reducer:{
        websocket: websocketReducer,
        game: gameReducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware)
})

sagaMiddleware.run(rootSaga);
