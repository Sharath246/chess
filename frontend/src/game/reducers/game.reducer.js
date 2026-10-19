import { createSlice } from "@reduxjs/toolkit"
import { BOTH, STATUS_CLOSED, STATUS_SUCCESS } from "../../utils/constants";

const initialValue = {
    gameFen: undefined,
    gameMove: undefined,
    gameId: undefined,
    playingAs: BOTH,
    blackSessionId: undefined,
    whiteSessionId: undefined,
    preGameAction: undefined,
    gameStatus: undefined, 
    playersInLobby: [],
    gameRequests: [],
    outgoingGameRequests: [],
    drawOffer: false,
    onlineResult: undefined,
    onlineNotice: "",
}

const gameSlice = createSlice({
    name: "gameSlice",
    initialState: initialValue,
    reducers: {
        setPlayersInLobby: (state, action) => {
            state.playersInLobby = action.payload;
        },
        addGameRequest: (state, action) => {
            if (!state.gameRequests.includes(action.payload)) {
                state.gameRequests.push(action.payload);
            }
        },
        removeGameRequest: (state, action) => {
            state.gameRequests = state.gameRequests.filter((username) => username !== action.payload);
        },
        addOutgoingGameRequest: (state, action) => {
            if (!state.outgoingGameRequests.includes(action.payload)) {
                state.outgoingGameRequests.push(action.payload);
            }
        },
        removeOutgoingGameRequest: (state, action) => {
            state.outgoingGameRequests = state.outgoingGameRequests.filter((username) => username !== action.payload);
        },
        setDrawOffer: (state, action) => {
            state.drawOffer = action.payload;
        },
        setOnlineResult: (state, action) => {
            state.onlineResult = action.payload;
        },
        setOnlineNotice: (state, action) => {
            state.onlineNotice = action.payload;
        },
        initiateGame: (state, action) => {
            state.gameStatus = STATUS_SUCCESS
            state.gameId = action.payload.gameId
            state.playingAs = action.payload.color
            state.whiteSessionId = action.payload.whiteId
            state.blackSessionId = action.payload.blackId
        },
        setGameUsingFEN: (state, action) => {
            state.gameFen = action.payload
        },
        setGameUsingMove: (state, action) => {
            state.gameMove = action.payload
        },
        setPreGameAction: (state, action) => {
            state.preGameAction = action.payload
        },
        terminateGame: (state, action) => {
            state.blackSessionId = undefined;
            state.gameFen = undefined;
            state.gameMove = undefined;
            state.gameId = undefined;
            state.playingAs = BOTH;
            state.blackSessionId = undefined;
            state.whiteSessionId = undefined;
            state.preGameAction = undefined;
            state.gameStatus = STATUS_CLOSED; 
            state.playersInLobby = [];
            state.gameRequests = [];
            state.outgoingGameRequests = [];
            state.drawOffer = false;
            state.onlineResult = undefined;
            state.onlineNotice = "";
        },
        setGameStatus: (state, action) => {
            state.gameStatus = action.payload
            console.log(state.gameStatus)
        }
    }
})

export const {
    setPlayersInLobby,
    addGameRequest,
    removeGameRequest,
    addOutgoingGameRequest,
    removeOutgoingGameRequest,
    setDrawOffer,
    setOnlineResult,
    setOnlineNotice,
    initiateGame,
    setGameUsingFEN,
    makeGameMove,
    setGameUsingMove,
    setPreGameAction,
    terminateGame,
    setGameStatus
} = gameSlice.actions

export const gameReducer = gameSlice.reducer