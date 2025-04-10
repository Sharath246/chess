import { Chess } from "chess.js";

export function fenToBoard(fen?: string): string[][] {
  if (!fen) return [];
  const rows: string[] = fen.split("/");
  const board: string[][] = [];

  for (const row of rows) {
    const boardRow: string[] = [];

    for (const char of row) {
      const num = parseInt(char, 10);
      if (isNaN(num)) {
        boardRow.push(char);
      } else {
        for (let i = 0; i < num; i++) {
          boardRow.push(" ");
        }
      }
    }

    board.push(boardRow);
  }

  return board;
}

export function receive_data(
  data: string,
  player: React.RefObject<boolean>,
  setGrid: React.Dispatch<React.SetStateAction<string[][]>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  game: React.RefObject<Chess | null>,
  setTurn: React.Dispatch<React.SetStateAction<boolean>>
) {
  console.log(data)
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
    const dataArr = data.split(" ");
    let from: string,
      to: string,
      promotion: string | undefined = undefined;
    from = dataArr[0].slice(2);
    to = dataArr[1].slice(2);
    if (dataArr.length > 2) promotion = dataArr[2].slice(2);
    game.current?.move({ from: from, to: to, promotion: promotion });
    let newGrid = fenToBoard(game.current?.fen().split(' ')[0]);
    setGrid(newGrid);
    setTurn((prev) => {
      return !prev;
    });
  }
}

export function sendMessage(
  from: string,
  to: string,
  websocketRef: React.RefObject<WebSocket | null>,
  promotion?: string
) {
  if (promotion) websocketRef.current?.send(`f:${from} t:${to} p:${promotion}`);
  else websocketRef.current?.send(`f:${from} t:${to}`);
}

export async function ComputerMessage(
  game: React.RefObject<Chess | null>,
  setGrid: React.Dispatch<React.SetStateAction<string[][]>>,
  setTurn: React.Dispatch<React.SetStateAction<boolean>>
) {
  const fen = game.current?.fen();
  if (!fen) return;
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(
    fen
  )}&multiPv=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Lichess API error: ${response.status}`);
    }

    const data: {
      depth: number;
      fen: String;
      knodes: number;
      pvs: any;
    } = await response.json();
    const firstLine = data.pvs[0]?.moves;
    if (!firstLine) return null;

    const bestMove = firstLine.split(" ")[0];

    const from = bestMove.substring(0, 2);
    const to = bestMove.substring(2, 4);
    const promotion = bestMove.length === 5 ? bestMove[4] : undefined;
    console.log(from,to,promotion)
    game.current?.move({ from, to, promotion });

    const newFen = game.current?.fen().split(" ")[0];
    setGrid(fenToBoard(newFen));
    setTurn((prev) => {
      return !prev;
    });
  } catch (error) {
    console.error("Failed to fetch evaluation:", error);
  }
}
