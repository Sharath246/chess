import React, { ReactNode, useEffect, useRef, useState } from "react";
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
  checkCheckMate,
} from "./chessFunctions.ts";
import LoadingScreen from "./LoadingScreen.tsx";

export default function OnlineGame() {
  const [turn, setTurn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState([-1, -1]);
  const movesEndRef = useRef<HTMLDivElement | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const [moves, setMoves] = useState<string[][]>([]);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionPiece, setPromotionPiece] = useState(" ");
  const [promotionRow, setPromotionRow] = useState(-1);
  const [promotionCol, setPromotionCol] = useState(-1);
  const player = useRef(true);
  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: 8 }, () => Array(8).fill(" "))
  );
  const [checkMate, setCheckMate] = useState("");

  function receive_data(data: string) {
    if (data === "black") {
      let newGrid = Array.from({ length: 8 }, () => Array(8).fill(" "));

      newGrid[0] = ["r", "n", "b", "q", "k", "b", "n", "r"];
      newGrid[7] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

      for (let i = 0; i < 8; i++) {
        newGrid[1][i] = "p";
        newGrid[6][i] = "P";
      }
      player.current = false;
      setGrid(newGrid);
      setLoading(false);
    } else if (data === "white") {
      let newGrid = Array.from({ length: 8 }, () => Array(8).fill(" "));

      newGrid[0] = ["r", "n", "b", "q", "k", "b", "n", "r"];
      newGrid[7] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

      for (let i = 0; i < 8; i++) {
        newGrid[1][i] = "p";
        newGrid[6][i] = "P";
      }
      setGrid(newGrid);
      setLoading(false);
    } else if (data !== "connection accepted") {
      let dataArray = data.split("/");
      data = dataArray[0];
      let newGrid = Array.from({ length: 8 }, (_, i) =>
        data.slice(i * 8, (i + 1) * 8).split("")
      );
      if (!player.current)
        setMoves((prev) => {
          return [...prev, [dataArray[1], "-"]];
        });
      else
        setMoves((prev) => {
          return [
            ...prev.slice(0, prev.length - 1),
            [prev[prev.length - 1][0], dataArray[1]],
          ];
        });
      setGrid(newGrid);
      setTurn((prev) => {
        return !prev;
      });
    }
  }

  function sendMessage(grid: string[][], move: string) {
    if (player.current)
      websocketRef.current?.send(grid.flat().join("") + "/" + move);
    else websocketRef.current?.send(grid.flat().join("") + "/" + move);
  }

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      return "Are you sure you want to leave?";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

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
        };
        resolve();
      });
    }

    waitForConnectionAndMessage();
  }, []);

  useEffect(() => {}, []);

  useEffect(() => {
    if (movesEndRef.current) {
      movesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [moves]);


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
      if (turn) {
        setMoves((prev) => {
          return [
            ...prev,
            [
              String.fromCharCode(col + 97) +
                (7 - row + 1).toString() +
                promotionPiece,
              "-",
            ],
          ];
        });
        sendMessage(
          newGrid,
          String.fromCharCode(col + 97) +
            (7 - row + 1).toString() +
            promotionPiece
        );
      } else {
        setMoves((prev) => {
          return [
            ...prev.slice(0, prev.length - 1),
            [
              prev[prev.length - 1][0],
              String.fromCharCode(col + 97) +
                (7 - row + 1).toString() +
                promotionPiece.toLocaleUpperCase(),
            ],
          ];
        });
        sendMessage(
          newGrid,
          String.fromCharCode(col + 97) +
            (7 - row + 1).toString() +
            promotionPiece.toLocaleUpperCase()
        );
      }
      setGrid(newGrid);
      setTurn(!turn);
    }
  }, [promotionPiece]);

  function cellFunction(row: number, col: number, value: string) {
    setShowPromotionModal(false);
    if (checkMate !== "") return;
    let newGrid = structuredClone(grid);
    if (
      (turn && blackPieces.includes(value)) ||
      (!turn && whitePieces.includes(value)) ||
      (player.current && blackPieces.includes(value)) ||
      (!player.current && whitePieces.includes(value)) ||
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
          setTurn,
          sendMessage
        )
      );
      if (checkCheckMate(newGrid, !turn, moves))
        setCheckMate(turn ? "black" : "white");
    }
    setGrid(newGrid);
  }
  return loading ? (
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
              ? `Black Won the game`
              : `White won the game`
          }
        >
          <></>
        </PromotionModal>
      )}
      <div className="chess-container">
        <div className="chess-players">
          <div className={(turn === false) + "-player"}>
            Black
          </div>
          <div className={turn + "-player"}>
            White
          </div>
        </div>
        <div className="grid-container">
          {player.current
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
          {moves.map((move, index) => (
            <Move
              key={index}
              number={index + 1}
              Wmove={move[0]}
              Bmove={move[1]}
            />
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
