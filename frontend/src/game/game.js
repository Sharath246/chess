import { useCallback, useEffect, useState } from "react";
import { Box, Modal, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { ACCEPT_DRAW_REQUEST, OFFER_DRAW, REJECT_DRAW_REQUEST, RESIGN_GAME, SEND_WEBSOCKET_MESSAGE } from "../utils/constants";
import { setDrawOffer } from "./reducers/game.reducer";
import { Timer } from "../common components/timer";
import ChessBoard from "./chessboard";
import Moves from "./moves";
import { useChessGame } from "./use-chess-game";

const Game = ({ playingAs }) => {
  const dispatch = useDispatch();
  const gameId = useSelector((state) => state.game.gameId);
  const drawOffer = useSelector((state) => state.game.drawOffer);
  const onlineResult = useSelector((state) => state.game.onlineResult);
  const onlineNotice = useSelector((state) => state.game.onlineNotice);
  const [timeoutColor, setTimeoutColor] = useState(null);

  useEffect(() => {
    const confirmReload = (event) => {
      event.preventDefault();
      event.returnValue = "Your current game will end if you leave or reload this page.";
      return event.returnValue;
    };

    window.addEventListener("beforeunload", confirmReload);
    return () => window.removeEventListener("beforeunload", confirmReload);
  }, []);
  const {
    board,
    error,
    moves,
    possibleMoves,
    promotion,
    selectedCell,
    selectedMove,
    selectHistory,
    selectSquare,
    promote,
    status,
    turn,
  } = useChessGame(playingAs);

  const currentTurn = turn;
  const handleTimeout = useCallback((color) => setTimeoutColor(color), []);
  const result = timeoutColor
    ? { title: "Time out", winner: timeoutColor === "w" ? "b" : "w" }
    : onlineResult;
  const gameOver = Boolean(result);
  const winnerName = result?.winner === "w" ? "White" : result?.winner === "b" ? "Black" : null;

  return (
    <main className="game-page">
      <Moves
        moves={moves}
        selectedMove={selectedMove}
        onSelectMove={selectHistory}
      />

      <section className="game-status">
        <Typography variant="h5">{currentTurn === "w" ? "White's move" : "Black's move"}</Typography>
        <Timer activeColor={currentTurn} gameOver={gameOver} onTimeout={handleTimeout} />
        {status && <Typography>{status}</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        {onlineNotice && <Typography>{onlineNotice}</Typography>}
        {playingAs !== "both" && !gameOver && (
          <div className="online-game-actions">
            <button type="button" onClick={() => dispatch({ type: SEND_WEBSOCKET_MESSAGE, payload: { type: OFFER_DRAW, gameId } })}>Offer draw</button>
            <button type="button" onClick={() => dispatch({ type: SEND_WEBSOCKET_MESSAGE, payload: { type: RESIGN_GAME, gameId } })}>Resign</button>
          </div>
        )}
      </section>

      <section className={`game-board ${gameOver ? "game-over" : ""}`}>
        <div className="board-layer">
          <ChessBoard
            board={board}
            playingAs={playingAs}
            possibleMoves={possibleMoves}
            selectedCell={selectedCell}
            selectedMove={selectedMove}
            totalMoves={moves.length}
            handleSelect={selectSquare}
          />
        </div>
        {gameOver && (
          <div className="game-over-overlay" role="status">
            <span className="panel-eyebrow">MATCH COMPLETE</span>
            <strong>{result.title}</strong>
            <span>{winnerName ? `${winnerName} wins` : "The game is a draw"}</span>
          </div>
        )}
      </section>

      <PromotionModal promotion={promotion} onSelect={promote} />
      {drawOffer && !gameOver && (
        <div className="draw-offer" role="dialog" aria-label="Draw offer">
          <span>Your opponent offered a draw</span>
          <button type="button" onClick={() => { dispatch(setDrawOffer(false)); dispatch({ type: SEND_WEBSOCKET_MESSAGE, payload: { type: ACCEPT_DRAW_REQUEST, gameId } }); }}>Accept</button>
          <button type="button" onClick={() => { dispatch(setDrawOffer(false)); dispatch({ type: SEND_WEBSOCKET_MESSAGE, payload: { type: REJECT_DRAW_REQUEST, gameId } }); }}>Decline</button>
        </div>
      )}
    </main>
  );
};

const PromotionModal = ({ promotion, onSelect }) => {
  const pieces = ["q", "r", "b", "n"];
  const prefix = promotion?.color === "w" ? "w" : "";

  return (
    <Modal open={Boolean(promotion)} onClose={() => {}}>
      <Box className="promotion-modal">
        <Typography variant="h6">Choose promotion piece</Typography>
        <Box className="promotion-pieces">
          {pieces.map((piece) => (
            <button key={piece} type="button" onClick={() => onSelect(piece)}>
              <img src={`../pieces/${prefix}${piece.toUpperCase()}.svg`} alt={`${piece} promotion`} />
            </button>
          ))}
        </Box>
      </Box>
    </Modal>
  );
};

export default Game;
