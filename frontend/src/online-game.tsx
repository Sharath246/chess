import React, { useEffect, useRef, useState } from "react";
import "./chessboard.css";
import { Square } from "./Square.tsx";
import {
  whitePieces,
  blackPieces,
  clearGrid,
  kingMoves,
  checkCastle,
  diagonalMoves,
  verticalMoves,
  pawnMoves,
  knightMoves,
  enPassant,
  removeBadMoves,
  moveFunction,
} from "./chessFunctions.ts";

export default function OnlineGame() {
  const [turn, setTurn] = useState(true);
  const [loading,setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState([-1, -1]);
  const movesEndRef = useRef<HTMLDivElement | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  let player1 = "Player1",
    player2 = "Player2",
    time = 3600;
  const [timer1, setTimer1] = useState<number>(Number(time) * 2);
  const [timer2, setTimer2] = useState<number>(Number(time) * 2);
  const [moves, setMoves] = useState<string[][]>([]);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionPiece, setPromotionPiece] = useState(" ");
  const [promotionRow, setPromotionRow] = useState(-1);
  const [promotionCol, setPromotionCol] = useState(-1);
  const [player, setPlayer] = useState(true);
  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: 8 }, () => Array(8).fill(" "))
  );

  function rotate180(grid) {
    return grid.map((row) => [...row].reverse()).reverse();
  }

  function receive_data(data: string) {
    console.log(data);
    if (data === "white") setPlayer(true);
    else if (data !== "connection accepted") {
      let newGrid = Array.from({ length: 8 }, (_, i) =>
        data.slice(i * 8, (i + 1) * 8).split("")
      );
      if (!player)
        newGrid = rotate180(newGrid);
      setTurn(!turn);
      setGrid(newGrid);
    }
  }

  function sendMessage(grid) {
    websocketRef.current?.send(grid.flat().join(""));
  }

  useEffect(() => {
    if (websocketRef.current) return;

    const randInteger = Math.floor(Math.random() * 10000);
    const websocket = new WebSocket(
      `ws://127.0.0.1:9000/play-game?client_id=${randInteger}`
    );
    websocketRef.current = websocket;

    async function waitForConnectionAndMessage() {
      return new Promise<void>((resolve) => {
        websocket.onopen = () => {};
        websocket.onmessage = (event) => {
          receive_data(event.data);
          websocket.onmessage = (event) => {
            receive_data(event.data);
            resolve();
          };
        };
      });
    }

    async function initializeConnection() {
      await waitForConnectionAndMessage();
      setLoading(false);
    }

    initializeConnection();
  }, []);

  useEffect(() => {
    let newGrid = Array.from({ length: 8 }, () => Array(8).fill(" "));

    newGrid[0] = ["r", "n", "b", "q", "k", "b", "n", "r"];
    newGrid[7] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

    for (let i = 0; i < 8; i++) {
      newGrid[1][i] = "p";
      newGrid[6][i] = "P";
    }
    setGrid(rotate180(newGrid));
  }, []);

  useEffect(() => {
    if (movesEndRef.current) {
      movesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [moves]);

  useEffect(() => {
    if (!time || Number.isNaN(time)) return;
    if (Number(time) !== 0 && (timer1 === 0 || timer2 === 0)) {
      if (timer1 === 0) alert(`Time Up!! ${player2} won the game`);
      else alert(`Time Up!! ${player1} won the game`);
    }
    const interval = setInterval(() => {
      setTurn((prevTurn) => {
        if (prevTurn) {
          setTimer1((prev) => Math.max(0, prev - 1));
        } else {
          setTimer2((prev) => Math.max(0, prev - 1));
        }
        return prevTurn;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (promotionPiece !== " ") {
      let newGrid = grid.map((row) => [...row]),
        row = promotionRow,
        col = promotionCol;
      newGrid[selectedIndex[0]][selectedIndex[1]] = " ";
      newGrid[row][col] = promotionPiece;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (newGrid[i][j] === ".") newGrid[i][j] = " ";
          else if (newGrid[i][j][0] === "x") newGrid[i][j] = newGrid[i][j][1];
        }
      }
      if (turn)
        setMoves([
          ...moves,
          [
            String.fromCharCode(col + 97) +
              (7 - row + 1).toString() +
              promotionPiece,
            "-",
          ],
        ]);
      else
        setMoves([
          ...moves.slice(0, moves.length - 1),
          [
            moves[moves.length - 1][0],
            String.fromCharCode(col + 97) +
              (7 - row + 1).toString() +
              promotionPiece.toLocaleUpperCase(),
          ],
        ]);
      setGrid(newGrid);
      setTurn(!turn);
    }
  }, [promotionPiece]);

  function cellFunction(row: number, col: number, value: string) {
    setShowPromotionModal(false);
    let newGrid = structuredClone(grid);
    if (
      (turn && blackPieces.includes(value)) ||
      (!turn && whitePieces.includes(value)) ||
      value === " "
    )
      newGrid = structuredClone(clearGrid(newGrid));
    else if (value[0] !== "." && value[0] !== "x") {
      newGrid = clearGrid(newGrid);
      if (value.toLocaleLowerCase() === "k") {
        newGrid = structuredClone(kingMoves(row, col, newGrid, turn));
        newGrid = structuredClone(checkCastle(turn, moves, newGrid));
      } else if (value.toLocaleLowerCase() === "q") {
        newGrid = structuredClone(diagonalMoves(row, col, newGrid, turn));
        newGrid = structuredClone(verticalMoves(row, col, newGrid, turn));
      } else if (value.toLocaleLowerCase() === "p") {
        newGrid = structuredClone(pawnMoves(row, col, turn, newGrid));
      } else if (value.toLocaleLowerCase() === "r")
        newGrid = structuredClone(verticalMoves(row, col, newGrid, turn));
      else if (value.toLocaleLowerCase() === "b")
        newGrid = structuredClone(diagonalMoves(row, col, newGrid, turn));
      else if (value.toLocaleLowerCase() === "n")
        newGrid = structuredClone(knightMoves(row, col, newGrid, turn));
      newGrid = structuredClone(removeBadMoves(newGrid, row, col, turn));
      newGrid = structuredClone(enPassant(turn, row, col, moves, newGrid));
      setSelectedIndex([row, col]);
    } else {
      newGrid = structuredClone(
        moveFunction(
          row,
          col,
          grid,
          newGrid,
          setMoves,
          selectedIndex,
          setSelectedIndex,
          setPromotionCol,
          setPromotionRow,
          setShowPromotionModal,
          turn,
          moves,
          setTurn
        )
      );
      sendMessage(newGrid);
    }
    setGrid(newGrid);
  }

  return (
    <div className="chess-page">
      {showPromotionModal && (
        <PromotionModal
          turn={turn}
          setShowPromotionModal={setShowPromotionModal}
          setPromotionPiece={setPromotionPiece}
        />
      )}
      <div className="chess-container">
        <div className="chess-players">
          <div className={(turn === false) + "-player"}>
            {player2}
            {timer2 !== null &&
              !Number.isNaN(timer2) &&
              timer2 !== 0 &&
              " - " +
                `${Math.floor(timer2 / 120)}:${
                  Math.floor(((timer2 / 2) % 60) / 10) === 0 ? "0" : ""
                }${(timer2 / 2) % 60}`}
          </div>
          <div className={turn + "-player"}>
            {player1}
            {timer1 !== null &&
              !Number.isNaN(timer1) &&
              timer2 !== 0 &&
              " - " +
                `${Math.floor(timer1 / 120)}:${
                  Math.floor(((timer1 / 2) % 60) / 10) === 0 ? "0" : ""
                }${(timer1 / 2) % 60}`}
          </div>
        </div>
        <div className="grid-container">
          {grid.map((row: string[], rowIndex: number) =>
            row.map((cellValue: string, colIndex: number) => (
              <Square
                key={`${rowIndex}-${colIndex}`}
                value={cellValue}
                row={rowIndex}
                col={colIndex}
                onClick={() => {
                  cellFunction(rowIndex, colIndex, cellValue);
                }}
              />
            ))
          )}
        </div>
      </div>
      <div className="moves-container">
        <div className="moves-heading">Moves</div>
        <div className="moves-box">
          {moves.map((move, index) => (
            <Move number={index + 1} Wmove={move[0]} Bmove={move[1]} />
          ))}
          <div ref={movesEndRef} />
        </div>
      </div>
    </div>
  );
}

type PromotionModalProps = {
  turn: boolean;
  setShowPromotionModal: React.Dispatch<React.SetStateAction<boolean>>;
  setPromotionPiece: React.Dispatch<React.SetStateAction<string>>;
};

function PromotionModal({
  turn,
  setShowPromotionModal,
  setPromotionPiece,
}: PromotionModalProps) {
  return (
    <div className="promotion-modal-overlay">
      <div className="promotion-modal">
        <span className="promotion-title">Choose a Piece</span>
        <div className="promotion-options">
          {["Q", "R", "N", "B"].map((piece) => (
            <img
              className="promotion-button"
              src={`/pieces/${turn ? "w" : "b"}${piece}.svg`}
              alt={piece}
              onClick={() => {
                setShowPromotionModal(false);
                setPromotionPiece(turn ? piece : piece.toLowerCase());
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Move({ number, Wmove, Bmove }) {
  return (
    <div className="move-item">
      <div style={{ width: "10%" }}>{number}</div>
      <div style={{ width: "20%" }}>{Wmove}</div>
      <div style={{ width: "20%" }}>{Bmove}</div>
    </div>
  );
}

