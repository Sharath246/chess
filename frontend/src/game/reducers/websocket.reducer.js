import { createSlice } from "@reduxjs/toolkit"
import { STATUS_CLOSED, STATUS_FAIL, STATUS_PENDING, STATUS_SUCCESS } from "../../utils/constants";

const initialValue = {
    websocket_connect_status : undefined,
    sessionId: sessionStorage.getItem("sessionId") || undefined,
    receivedMessages: [],
    sentMessages: [],
}

const websocketSlice = createSlice({
    name: "websocketSlice",
    initialState: initialValue,
    reducers: {
        websocketConnectionStart: (state, action) => {
            state.websocket_connect_status = STATUS_PENDING
        },
        websocketConnectionSuccess: (state, action) => {
            state.websocket_connect_status = STATUS_SUCCESS
        },
        websocketConnectionClose: (state, action) => {
            console.log("closed")
            state.websocket_connect_status = STATUS_CLOSED
        },
        websocketConnectionFail: (state, action) => {
            console.log("fail")
            state.websocket_connect_status = STATUS_FAIL
        },
        setSessionId: (state, action) => {
            state.sessionId = action.payload
        },
        setWebsocketReceivedMessages: (state, action) => {
            if(action.payload instanceof Array){
                state.receivedMessages.push(...action.payload)
            }
            else{
                state.receivedMessages.push(action.payload)
            }
        },
        setWebsocketSentMessages: (state, action) => {
            if(action.payload instanceof Array){
                state.sentMessages.push(...action.payload)
            }
            else{
                state.sentMessages.push(action.payload)
            }
        }
    }
})

export const {
    setConnection,
    websocketConnectionStart,
    websocketConnectionSuccess,
    websocketConnectionFail,
    websocketConnectionClose,
    setSessionId,
    setWebsocketReceivedMessages,
    setWebsocketSentMessages
} = websocketSlice.actions

export const websocketReducer = websocketSlice.reducer