import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { useDispatch, useSelector } from "react-redux";
import { BOTH, MAKE_MOVE, SEND_WEBSOCKET_MESSAGE } from "../utils/constants";

const boardFromFen = (fen) => fen.split(" ")[0];

export const useChessGame = (playingAs) => {
  const chess = useRef(new Chess());
  const dispatch = useDispatch();
  const gameId = useSelector((state) => state.game.gameId);
  const incomingFen = useSelector((state) => state.game.gameFen);
  const serverResult = useSelector((state) => state.game.onlineResult);
  const [board, setBoard] = useState(boardFromFen(chess.current.fen()));
  const [positions, setPositions] = useState([chess.current.fen()]);
  const [moves, setMoves] = useState([]);
  const [selectedMove, setSelectedMove] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [promotion, setPromotion] = useState(null);
  const [error, setError] = useState("");

  const sendMove = useCallback((move) => {
    if (playingAs === BOTH) return;

    dispatch({
      type: SEND_WEBSOCKET_MESSAGE,
      payload: {
        type: MAKE_MOVE,
        gameId,
        move,
      },
    });
  }, [dispatch, gameId, playingAs]);

  const applyMove = useCallback((move, shouldSend = false) => {
    try {
      const playedMove = chess.current.move(move);
      const nextFen = chess.current.fen();
      const nextMoves = chess.current.history();

      setBoard(boardFromFen(nextFen));
      setPositions((current) => [...current.slice(0, nextMoves.length), nextFen]);
      setMoves(nextMoves);
      setSelectedMove(nextMoves.length);
      setSelectedCell(null);
      setPossibleMoves([]);

      if (shouldSend) sendMove(playedMove.san);
      return true;
    } catch {
      setError("Illegal move");
      window.setTimeout(() => setError(""), 2000);
      return false;
    }
  }, [sendMove]);

  useEffect(() => {
    if (!incomingFen) return;
    const nextGame = new Chess(incomingFen);
    chess.current = nextGame;
    setBoard(boardFromFen(incomingFen));
    setPositions([incomingFen]);
    setMoves(nextGame.history());
    setSelectedMove(nextGame.history().length);
    setSelectedCell(null);
    setPossibleMoves([]);
  }, [incomingFen]);

  const selectSquare = useCallback((square, piece) => {
    if (selectedMove !== moves.length || serverResult) return;
    if (playingAs !== BOTH && playingAs[0] !== chess.current.turn()) return;

    const selectedPiece = chess.current.get(square);
    if (!selectedCell) {
      if (!selectedPiece || selectedPiece.color !== chess.current.turn()) return;
      setSelectedCell({ position: square, piece });
      const destinations = chess.current
        .moves({ square, verbose: true })
        .map((move) => move.to);
      setPossibleMoves(destinations);
      return;
    }

    if (selectedCell.position === square) {
      setSelectedCell(null);
      setPossibleMoves([]);
      return;
    }

    const isPromotion = selectedCell.piece?.toLowerCase() === "p" &&
      (square.endsWith("1") || square.endsWith("8"));

    if (isPromotion) {
      setPromotion({ from: selectedCell.position, to: square, color: chess.current.turn() });
      return;
    }

    applyMove({ from: selectedCell.position, to: square }, true);
  }, [applyMove, moves.length, playingAs, selectedCell, selectedMove, serverResult]);

  const promote = useCallback((piece) => {
    if (!promotion) return;
    setPromotion(null);
    applyMove({ ...promotion, promotion: piece }, true);
  }, [applyMove, promotion]);

  const selectHistory = useCallback((moveNumber) => {
    const nextPosition = positions[moveNumber];
    if (!nextPosition) return;
    setSelectedMove(moveNumber);
    setBoard(boardFromFen(nextPosition));
  }, [positions]);

  const status = chess.current.inCheck()
    ? `${chess.current.turn() === "w" ? "White" : "Black"} in check`
    : "";
  const turn = chess.current.turn();

  return {
    board,
    error,
    moves,
    possibleMoves,
    promotion,
    selectedCell,
    selectedMove,
    status,
    turn,
    selectHistory,
    selectSquare,
    promote,
  };
};