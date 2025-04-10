import React, { ReactNode, useEffect, useRef, useState } from "react";
import "./chessboard.css";
import { Chess } from "chess.js";
import { Square } from "./Square.tsx";
import { useParams } from "react-router-dom";
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
  checkCheckMate,
} from "./chessFunctions.ts";
import { receive_data, ComputerMessage, sendMessage } from "./appFunctions.ts";
import LoadingScreen from "./LoadingScreen.tsx";

export default function Chessboard({ gameType }) {
  const [turn, setTurn] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState([-1, -1]);
  const movesEndRef = useRef<HTMLDivElement | null>(null);
  let { player1, player2, time } = useParams();
  const [timer1, setTimer1] = useState<number>(Number(time));
  const [timer2, setTimer2] = useState<number>(Number(time));
  const game = useRef<Chess | null>(null);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionPiece, setPromotionPiece] = useState(" ");
  const [promotionRow, setPromotionRow] = useState(-1);
  const [promotionCol, setPromotionCol] = useState(-1);
  const websocketRef = useRef<WebSocket | null>(null);
  const [loading, setLoading] = useState(true);
  const player = useRef(true);
  const random = Math.random();
  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: 8 }, () => Array(8).fill(" "))
  );
  const [checkMate, setCheckMate] = useState("");

  useEffect(() => {
    let newGrid: string[][];
    game.current = new Chess();
    if (gameType === "Online") {
      if (websocketRef.current) return;

      const randInteger = Math.floor(Math.random() * 10000);
      const websocket = new WebSocket(
        `wss://chess-backend-ao0a.onrender.com/play-game?client_id=${randInteger}`
      );
      websocketRef.current = websocket;

      async function waitForConnectionAndMessage() {
        return new Promise<void>((resolve) => {
          websocket.onopen = () => {};
          websocket.onmessage = (event) => {
            receive_data(
              event.data,
              player,
              setGrid,
              setLoading,
              game,
              setTurn
            );
          };
          resolve();
        });
      }
      waitForConnectionAndMessage();
    } else if (gameType === "2Player") {
      newGrid = Array.from({ length: 8 }, () => Array(8).fill(" "));
      game.current = new Chess();
      newGrid[0] = ["r", "n", "b", "q", "k", "b", "n", "r"];
      newGrid[7] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

      for (let i = 0; i < 8; i++) {
        newGrid[1][i] = "p";
        newGrid[6][i] = "P";
      }
      setGrid(newGrid);
    } else {
      player.current = random > 0.5;
      newGrid = Array.from({ length: 8 }, () => Array(8).fill(" "));

      newGrid[0] = ["r", "n", "b", "q", "k", "b", "n", "r"];
      newGrid[7] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

      for (let i = 0; i < 8; i++) {
        newGrid[1][i] = "p";
        newGrid[6][i] = "P";
      }
      setGrid(newGrid);
    }
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
    if (movesEndRef.current) {
      movesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [game.current?.moveNumber]);

  useEffect(() => {
    if (turn != player.current && gameType === "Computer") {
      ComputerMessage(game, setGrid, setTurn);
    }
  }, [turn]);

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
      game.current?.move({
        from: `${String.fromCharCode(selectedIndex[1] + 97)}${
          8 - selectedIndex[0]
        }`,
        to: `${String.fromCharCode(col + 97)}${8 - row}`,
        promotion: promotionPiece,
      });
      if (gameType === "Online") {
        sendMessage(
          `${String.fromCharCode(selectedIndex[1] + 97)}${
            8 - selectedIndex[0]
          }`,
          `${String.fromCharCode(col + 97)}${8 - row}`,
          websocketRef,
          promotionPiece
        );
      }
      setGrid(newGrid);
      setTurn(!turn);
    }
  }, [promotionPiece]);

  function cellFunction(row: number, col: number, value: string) {
    setShowPromotionModal(false);
    let arr = game.current?.history();
    if (arr && arr.length % 2 !== 0) arr.push("-");
    let moves: string[][] = [];
    if (arr) {
      for (let i = 0; i < arr.length; i += 2) {
        moves.push([arr[i], arr[i + 1]]);
      }
    }
    if (checkMate !== "") return;
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
          selectedIndex,
          setSelectedIndex,
          setPromotionCol,
          setPromotionRow,
          setShowPromotionModal,
          turn,
          setTurn,
          game,
          gameType === "Online" ? sendMessage : undefined,
          websocketRef
        )
      );
      if (checkCheckMate(newGrid, !turn, moves))
        setCheckMate(turn ? "black" : "white");
    }
    setGrid(newGrid);
  }

  return gameType === "Online" && loading ? (
    <LoadingScreen />
  ) : (
    <div className="chess-page">
      {showPromotionModal && (
        <PromotionModal
          turn={turn}
          setShowPromotionModal={setShowPromotionModal}
          setPromotionPiece={setPromotionPiece}
          title={"Choose a Piece"}
        >
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
        </PromotionModal>
      )}
      {checkMate !== "" && (
        <PromotionModal
          turn={turn}
          setShowPromotionModal={setShowPromotionModal}
          title={
            checkMate === "white"
              ? `${player2} Won the game`
              : `${player1} won the game`
          }
        >
          <></>
        </PromotionModal>
      )}
      <div className="chess-container">
        <div className="chess-players">
          <div className={(turn === false) + "-player"}>
            {player2}
            {timer2 !== null &&
              !Number.isNaN(timer2) &&
              timer2 !== 0 &&
              " - " +
                `${Math.floor(timer2 / 60)}:${
                  Math.floor((timer2 % 60) / 10) === 0 ? "0" : ""
                }${timer2 % 60}`}
          </div>
          <div className={turn + "-player"}>
            {player1}
            {timer1 !== null &&
              !Number.isNaN(timer1) &&
              timer2 !== 0 &&
              " - " +
                `${Math.floor(timer1 / 60)}:${
                  Math.floor((timer1 % 60) / 10) === 0 ? "0" : ""
                }${timer1 % 60}`}
          </div>
        </div>
        <div className="grid-container">
          {gameType === "2Player"
            ? grid.map((row: string[], rowIndex: number) =>
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
              )
            : player.current
            ? grid.map((row: string[], rowIndex: number) =>
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
              )
            : grid
                .slice()
                .reverse()
                .map((row: string[], rowIndex: number) =>
                  row
                    .slice()
                    .reverse()
                    .map((cellValue: string, colIndex: number) => (
                      <Square
                        key={`${rowIndex}-${colIndex}`}
                        value={cellValue}
                        row={7 - rowIndex}
                        col={7 - colIndex}
                        onClick={() => {
                          cellFunction(7 - rowIndex, 7 - colIndex, cellValue);
                        }}
                      />
                    ))
                )}
        </div>
      </div>
      <div className="moves-container">
        <div className="moves-heading">Moves</div>
        <div className="moves-box">
          <MoveManager all_moves={game.current?.history()} />
          <div ref={movesEndRef} />
        </div>
      </div>
    </div>
  );
}

type PromotionModalProps = {
  turn: boolean;
  setShowPromotionModal: React.Dispatch<React.SetStateAction<boolean>>;
  setPromotionPiece?: React.Dispatch<React.SetStateAction<string>>;
  title: string;
  children: ReactNode;
};

function PromotionModal({
  turn,
  setShowPromotionModal,
  setPromotionPiece,
  ...props
}: PromotionModalProps) {
  return (
    <div className="promotion-modal-overlay">
      <div className="promotion-modal">
        <span className="promotion-title">{props.title}</span>
        {props.children}
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

function MoveManager({ all_moves }) {
  let arr = all_moves || [];
  if (arr.length % 2 !== 0) arr.push("-");
  let moves: string[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    moves.push([arr[i], arr[i + 1]]);
  }
  return (
    <>
      {moves.map((move, index) => (
        <Move key={index} number={index + 1} Wmove={move[0]} Bmove={move[1]} />
      ))}
    </>
  );
}
