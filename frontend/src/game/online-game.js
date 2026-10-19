import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ACCEPT_GAME_REQUEST, READY_FOR_GAME, REJECT_GAME_REQUEST, REQUEST_GAME, SEND_WEBSOCKET_MESSAGE, STATUS_CLOSED, STATUS_FAIL, STATUS_PENDING, STATUS_SUCCESS } from "../utils/constants";
import { websocketConnectionStart } from "./reducers/websocket.reducer";
import Game from "./game";
import { Chess } from "chess.js";
import ChessBoard from "./chessboard";
import "../App.css";
import { setSessionId } from "./reducers/websocket.reducer";
import { getOnlinePlayers } from "./online-api";
import { addOutgoingGameRequest, removeGameRequest } from "./reducers/game.reducer";

const OnlineGame = () => {
    const dispatch = useDispatch();
    const connection = useSelector(state => state.websocket.websocket_connect_status);
    const sessionId = useSelector(state => state.websocket.sessionId);
    const gameStatus = useSelector(state => state.game.gameStatus);
    const playingAs = useSelector(state => state.game.playingAs);
    const [onlinePlayers, setOnlinePlayers] = useState([]);
    const [lobbyError, setLobbyError] = useState("");
    const gameRequests = useSelector(state => state.game.gameRequests);
    const outgoingGameRequests = useSelector(state => state.game.outgoingGameRequests);
    const readySent = useRef(false);

    useEffect(() => {
        const storedSessionId = sessionStorage.getItem("sessionId");
        if (storedSessionId && storedSessionId !== sessionId) {
            dispatch(setSessionId(storedSessionId));
        }
    }, [dispatch, sessionId]);

    useEffect(() => {
        dispatch(websocketConnectionStart());
    }, [dispatch]);

    useEffect(() => {
        if (connection === STATUS_SUCCESS && sessionId && !readySent.current) {
            readySent.current = true;
            dispatch({ type: SEND_WEBSOCKET_MESSAGE, payload: { type: READY_FOR_GAME } });
        }
    }, [connection, dispatch, sessionId]);

    useEffect(() => {
        if (connection !== STATUS_SUCCESS || !sessionId) return undefined;
        let cancelled = false;

        const refreshPlayers = async () => {
            try {
                const players = await getOnlinePlayers();
                if (!cancelled) {
                    setOnlinePlayers(players.filter((player) => player !== sessionStorage.getItem("username")));
                    setLobbyError("");
                }
            } catch (error) {
                if (!cancelled) setLobbyError(error.message);
            }
        };

        refreshPlayers();
        const intervalId = window.setInterval(refreshPlayers, 2000);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [connection, sessionId]);

    const requestGame = (opponentUsername) => {
        dispatch(addOutgoingGameRequest(opponentUsername));
        dispatch({
            type: SEND_WEBSOCKET_MESSAGE,
            payload: { type: REQUEST_GAME, opponentUsername },
        });
    };

    const respondToGameRequest = (opponentUsername, type) => {
        dispatch(removeGameRequest(opponentUsername));
        dispatch({
            type: SEND_WEBSOCKET_MESSAGE,
            payload: { type, opponentUsername },
        });
    };

    if (gameStatus === STATUS_SUCCESS) {
        return <Game playingAs={playingAs} />;
    }

    if (connection === STATUS_FAIL || connection === STATUS_CLOSED) {
        return <div className="waiting-page"><p>Connection lost. Please reload to try again.</p></div>;
    }

    return (
        <main className="waiting-page">
            <div className="waiting-board" aria-hidden="true">
                <ChessBoard
                    board={new Chess().fen().split(" ")[0]}
                    playingAs="white"
                    possibleMoves={[]}
                    selectedMove={0}
                    totalMoves={0}
                    handleSelect={() => {}}
                />
            </div>
            <section className="waiting-copy" aria-live="polite">
                <span className="waiting-kicker">ONLINE MATCH</span>
                <h1>{connection === STATUS_PENDING ? "Connecting" : "Waiting for a match"}</h1>
                <p>{connection === STATUS_PENDING ? "Preparing the board" : "We are finding an opponent for you. The game starts as soon as they join."}</p>
                {connection === STATUS_SUCCESS && (
                    <section className="online-lobby" aria-label="Online players">
                        <div className="online-lobby-heading">
                            <strong>Players online</strong>
                            <span>{onlinePlayers.length}</span>
                        </div>
                        {lobbyError && <p className="auth-error" role="alert">{lobbyError}</p>}
                        {onlinePlayers.length === 0 ? (
                            <p className="online-empty">Waiting for another player to connect.</p>
                        ) : (
                            <ul className="online-player-list">
                                {onlinePlayers.map((username) => (
                                    <li key={username}>
                                        <span>{username}</span>
                                        {gameRequests.includes(username) ? (
                                            <div className="game-request-actions">
                                                <button type="button" className="request-accept" aria-label={`Accept game request from ${username}`} onClick={() => respondToGameRequest(username, ACCEPT_GAME_REQUEST)}>✓</button>
                                                <button type="button" className="request-reject" aria-label={`Reject game request from ${username}`} onClick={() => respondToGameRequest(username, REJECT_GAME_REQUEST)}>×</button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="lobby-request"
                                                onClick={() => requestGame(username)}
                                                disabled={outgoingGameRequests.includes(username)}
                                            >
                                                {outgoingGameRequests.includes(username) ? "Requested" : "Request game"}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
                <div className="waiting-dots" aria-label="Waiting" />
            </section>
        </main>
    );
};
export default OnlineGame;
