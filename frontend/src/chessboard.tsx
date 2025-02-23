import React, { useEffect, useRef, useState } from "react";
import "./chessboard.css";
import { Square } from "./Square.tsx";
import { useParams } from "react-router-dom";

export default function Chessboard() {
  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: 8 }, () => Array(8).fill(" "))
  );
  const [turn, setTurn] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState([-1, -1]);
  const movesEndRef = useRef<HTMLDivElement | null>(null);
  let { player1, player2, time } = useParams();
  const [timer1, setTimer1] = useState<number>(Number(time) * 2);
  const [timer2, setTimer2] = useState<number>(Number(time) * 2);
  const [moves, setMoves] = useState<string[][]>([]);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionPiece, setPromotionPiece] = useState(" ");
  const [promotionRow, setPromotionrow] = useState(-1);
  const [promotionCol, setPromotionCol] = useState(-1);
  const whitePieces = ["K", "Q", "R", "B", "N", "P"];
  const blackPieces = ["k", "q", "r", "b", "n", "p"];

  useEffect(() => {
    let newGrid = Array.from({ length: 8 }, () => Array(8).fill(" "));

    newGrid[0] = ["r", "n", "b", "q", "k", "b", "n", "r"];
    newGrid[7] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

    for (let i = 0; i < 8; i++) {
      newGrid[1][i] = "p";
      newGrid[6][i] = "P";
    }
    setGrid(newGrid);
  }, []);

  useEffect(() => {}, [selectedIndex, grid]);
  useEffect(() => {
    if (movesEndRef.current) {
      movesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [moves]);

  useEffect(() => {
    if (!time || Number.isNaN(time)) return;
    if( timer1 === 0 || timer2 === 0)
    {
      if(timer1 === 0)
      alert(`Time Up!! ${player2} won the game`);
      else
      alert(`Time Up!! ${player1} won the game`);
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

  function checkcheck(grid: string[][], x: number, y: number) {
    function diagonal() {
      let diagonals = [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
      for (let i = 0; i < diagonals.length; i++) {
        let p = x + diagonals[i][0],
          q = y + diagonals[i][1];
        while (
          ((diagonals[i][0] === 1 && p <= 7) ||
            (diagonals[i][0] === -1 && p >= 0)) &&
          ((diagonals[i][1] === 1 && q <= 7) ||
            (diagonals[i][1] === -1 && q >= 0))
        ) {
          if (turn) {
            if (blackPieces.includes(grid[p][q])) {
              if ("bq".includes(grid[p][q])) return true;
              else break;
            } else if (whitePieces.includes(grid[p][q])) break;
          } else {
            if (whitePieces.includes(grid[p][q])) {
              if ("BQ".includes(grid[p][q])) return true;
              else break;
            } else if (blackPieces.includes(grid[p][q])) break;
          }
          p += diagonals[i][0];
          q += diagonals[i][1];
        }
      }
    }
    function vertical() {
      let verticals = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ];
      for (let i = 0; i < verticals.length; i++) {
        let p = x + verticals[i][0],
          q = y + verticals[i][1];
        while (
          ((verticals[i][0] === 1 && p <= 7) ||
            (verticals[i][0] === -1 && p >= 0) ||
            verticals[i][0] === 0) &&
          ((verticals[i][1] === 1 && q <= 7) ||
            (verticals[i][1] === -1 && q >= 0) ||
            verticals[i][1] === 0)
        ) {
          if (turn) {
            if (blackPieces.includes(grid[p][q])) {
              if ("rq".includes(grid[p][q])) return true;
              else break;
            } else if (whitePieces.includes(grid[p][q])) break;
          } else {
            if (whitePieces.includes(grid[p][q])) {
              if ("RQ".includes(grid[p][q])) return true;
              else break;
            } else if (blackPieces.includes(grid[p][q])) break;
          }
          p += verticals[i][0];
          q += verticals[i][1];
        }
      }
    }
    if (diagonal() || vertical()) {
      return true;
    }
    let kings = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [1, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
    ];
    const horses = [
      [1, 2],
      [2, 1],
      [2, -1],
      [1, -2],
      [-1, 2],
      [-2, 1],
      [-1, -2],
      [-2, -1],
    ];
    for (let i = 0; i < kings.length; i++) {
      let p = x + kings[i][0],
        q = y + kings[i][1];
      if (p < 0 || q < 0 || p > 7 || q > 7) continue;
      if ((grid[p][q] === "K" && !turn) || (grid[p][q] === "k" && turn)) {
        console.log("here");
        return true;
      }
    }
    for (let i = 0; i < horses.length; i++) {
      let p = x + horses[i][0],
        q = y + horses[i][1];
      if (p < 0 || q < 0 || p > 7 || q > 7) continue;
      if ((turn && grid[p][q] === "n") || (!turn && grid[p][q] === "N")) {
        console.log("from here");
        return true;
      }
    }
    if (
      (turn &&
        ((x - 1 >= 0 && y - 1 >= 0 && grid[x - 1][y - 1] === "p") ||
          (x - 1 >= 0 && y + 1 <= 7 && grid[x - 1][y + 1] === "p"))) ||
      (!turn &&
        ((x + 1 <= 7 && y + 1 <= 7 && grid[x + 1][y + 1] === "P") ||
          (x + 1 <= 7 && y - 1 >= 0 && grid[x + 1][y - 1] === "P")))
    ) {
      console.log("from");
      return true;
    }
    return false;
  }
  function removeBadMoves(
    grid: string[][],
    row: number,
    col: number
  ): string[][] {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (grid[i][j] === "." || grid[i][j][0] === "x") {
          let newGrid = grid.map((row) => [...row]);
          newGrid[i][j] = newGrid[row][col];
          newGrid[row][col] = " ";
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              if (newGrid[i][j] === ".") newGrid[i][j] = " ";
              else if (newGrid[i][j][0] === "x")
                newGrid[i][j] = newGrid[i][j][1];
            }
          }
          if (turn) {
            let wx = 0,
              wy = 0;
            for (let i = 0; i < 8; i++) {
              for (let j = 0; j < 8; j++) {
                if (newGrid[i][j] === "K") {
                  wx = i;
                  wy = j;
                }
              }
            }
            if (checkcheck(newGrid, wx, wy)) {
              if (grid[i][j][0] === "x") grid[i][j] = grid[i][j][1];
              else grid[i][j] = " ";
            }
          } else {
            let bx = 0,
              by = 0;
            for (let i = 0; i < 8; i++) {
              for (let j = 0; j < 8; j++) {
                if (newGrid[i][j] === "k") {
                  bx = i;
                  by = j;
                }
              }
            }
            console.log(newGrid, bx, by, checkcheck(newGrid, bx, by));
            if (checkcheck(newGrid, bx, by)) {
              if (grid[i][j][0] === "x") grid[i][j] = grid[i][j][1];
              else grid[i][j] = " ";
            }
          }
        }
      }
    }
    return grid;
  }

  function gridFunction(row: number, col: number, value: string) {
    setShowPromotionModal(false);
    let newGrid = grid.map((row) => [...row]);
    if (
      (whitePieces.includes(value) && turn === false) ||
      (blackPieces.includes(value) && turn)
    ) {
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (newGrid[i][j] === ".") newGrid[i][j] = " ";
          else if (newGrid[i][j][0] === "x") newGrid[i][j] = newGrid[i][j][1];
        }
      }
      setSelectedIndex([row, col]);
    } else if (newGrid[row][col] !== "." && newGrid[row][col][0] !== "x") {
      function diagonalMoves() {
        let rownum = row - 1,
          colnum = col - 1;
        while (rownum >= 0 && colnum >= 0) {
          if (newGrid[rownum][colnum] === " ") newGrid[rownum][colnum] = ".";
          else if (
            (blackPieces.includes(newGrid[rownum][colnum]) && turn) ||
            (whitePieces.includes(newGrid[rownum][colnum]) && turn === false)
          ) {
            newGrid[rownum][colnum] = "x" + newGrid[rownum][colnum];
            break;
          } else break;
          rownum--;
          colnum--;
        }
        rownum = row + 1;
        colnum = col + 1;
        while (rownum < 8 && colnum < 8) {
          if (newGrid[rownum][colnum] === " ") newGrid[rownum][colnum] = ".";
          else if (
            (blackPieces.includes(newGrid[rownum][colnum]) && turn) ||
            (whitePieces.includes(newGrid[rownum][colnum]) && turn === false)
          ) {
            newGrid[rownum][colnum] = "x" + newGrid[rownum][colnum];
            break;
          } else break;
          rownum++;
          colnum++;
        }
        rownum = row + 1;
        colnum = col - 1;
        while (rownum < 8 && colnum >= 0) {
          if (newGrid[rownum][colnum] === " ") newGrid[rownum][colnum] = ".";
          else if (
            (blackPieces.includes(newGrid[rownum][colnum]) && turn) ||
            (whitePieces.includes(newGrid[rownum][colnum]) && turn === false)
          ) {
            newGrid[rownum][colnum] = "x" + newGrid[rownum][colnum];
            break;
          } else break;
          rownum++;
          colnum--;
        }
        rownum = row - 1;
        colnum = col + 1;
        while (rownum >= 0 && colnum < 8) {
          if (newGrid[rownum][colnum] === " ") newGrid[rownum][colnum] = ".";
          else if (
            (blackPieces.includes(newGrid[rownum][colnum]) && turn) ||
            (whitePieces.includes(newGrid[rownum][colnum]) && turn === false)
          ) {
            newGrid[rownum][colnum] = "x" + newGrid[rownum][colnum];
            break;
          } else break;
          rownum--;
          colnum++;
        }
      }
      function verticalMoves() {
        let p = row + 1,
          q = 0;
        while (p <= 7) {
          if (newGrid[p][col] === " ") newGrid[p][col] = ".";
          else if (
            (whitePieces.includes(newGrid[p][col]) && turn === false) ||
            (turn && blackPieces.includes(newGrid[p][col]))
          ) {
            newGrid[p][col] = "x" + newGrid[p][col];
            break;
          } else break;
          p++;
        }
        p = row - 1;
        while (p >= 0) {
          if (newGrid[p][col] === " ") newGrid[p][col] = ".";
          else if (
            (whitePieces.includes(newGrid[p][col]) && turn === false) ||
            (turn && blackPieces.includes(newGrid[p][col]))
          ) {
            newGrid[p][col] = "x" + newGrid[p][col];
            break;
          } else break;
          p--;
        }
        q = col - 1;
        while (q >= 0) {
          if (newGrid[row][q] === " ") newGrid[row][q] = ".";
          else if (
            (whitePieces.includes(newGrid[row][q]) && turn === false) ||
            (turn && blackPieces.includes(newGrid[row][q]))
          ) {
            newGrid[row][q] = "x" + newGrid[row][q];
            break;
          } else break;
          q--;
        }
        q = col + 1;
        while (q <= 7) {
          if (newGrid[row][q] === " ") newGrid[row][q] = ".";
          else if (
            (whitePieces.includes(newGrid[row][q]) && turn === false) ||
            (turn && blackPieces.includes(newGrid[row][q]))
          ) {
            newGrid[row][q] = "x" + newGrid[row][q];
            break;
          } else break;
          q++;
        }
      }
      function checkCastle() {
        let king = 1,
          r1 = 1,
          r2 = 1;
        if (turn) {
          for (let i = 0; i < moves.length; i++) {
            if (moves[i][0].startsWith("k")) {
              king = 0;
              break;
            }
          }
          if (king) {
            for (let i = 0; i < moves.length; i++) {
              let a = moves[i][0];
              if (
                a.startsWith("r") &&
                (a.endsWith("a7") || a.endsWith("a6") || a.endsWith("8"))
              )
                r2 = 0;
              else if (
                a.startsWith("r") &&
                (a.endsWith("a2") ||
                  a.endsWith("a3") ||
                  a.endsWith("a4") ||
                  a.endsWith("1"))
              )
                r1 = 0;
            }
            if (r1) {
              for (let i = 1; i < 4; i++) {
                if (grid[7][i] !== " ") {
                  r1 = 0;
                  break;
                }
              }
              if (r1) {
                for (let i = 2; i <= 4; i++) {
                  let tempGrid = grid.map((row) => [...row]);
                  tempGrid[7][i] = "K";
                  tempGrid[7][4] = " ";
                  if (checkcheck(tempGrid, 7, i)) {
                    r1 = 0;
                    break;
                  }
                }
                if (r1) newGrid[7][2] = ".";
              }
            }
            if (r2) {
              if (grid[7][5] === " " && grid[7][6] === " ") {
                for (let i = 4; i <= 6; i++) {
                  let tempGrid = grid.map((row) => [...row]);
                  tempGrid[7][i] = "K";
                  tempGrid[7][4] = " ";
                  if (checkcheck(tempGrid, 7, i)) {
                    r2 = 0;
                    break;
                  }
                }
                if (r2) newGrid[7][6] = ".";
              }
            }
          }
        } else {
          king = 1;
          r1 = 1;
          r2 = 1;
          for (let i = 0; i < moves.length; i++) {
            if (moves[i][1].startsWith("k")) {
              king = 0;
              break;
            }
          }
          if (king) {
            for (let i = 0; i < moves.length; i++) {
              let a = moves[i][1];
              if (
                a.startsWith("r") &&
                (a.endsWith("h7") || a.endsWith("h6") || a.endsWith("8"))
              )
                r2 = 0;
              else if (
                a.startsWith("r") &&
                (a.endsWith("h2") ||
                  a.endsWith("h3") ||
                  a.endsWith("h4") ||
                  a.endsWith("1"))
              )
                r1 = 0;
            }
            if (r1) {
              for (let i = 1; i < 4; i++) {
                if (grid[0][i] !== " ") {
                  r1 = 0;
                  break;
                }
              }
              if (r1) {
                for (let i = 2; i <= 4; i++) {
                  let tempGrid = grid.map((row) => [...row]);
                  tempGrid[0][i] = "K";
                  tempGrid[0][4] = " ";
                  if (checkcheck(tempGrid, 0, i)) {
                    r1 = 0;
                    break;
                  }
                }
                if (r1) newGrid[0][2] = ".";
              }
            }
            if (r2) {
              if (grid[0][5] === " " && grid[0][6] === " ") {
                for (let i = 4; i <= 6; i++) {
                  let tempGrid = grid.map((row) => [...row]);
                  tempGrid[0][i] = "k";
                  tempGrid[0][4] = " ";
                  if (checkcheck(tempGrid, 0, i)) {
                    r2 = 0;
                    break;
                  }
                }
                if (r2) newGrid[0][6] = ".";
              }
            }
          }
        }
      }
      function enPassant() {
        if (turn) {
          if (row === 3) {
            if (col >= 1 && newGrid[row][col - 1] === "p") {
              if (
                moves[moves.length - 1][1] ===
                `${String.fromCharCode(col - 1 + 97)}${5}`
              ) {
                let temp = grid.map((row) => [...row]);
                temp[2][col - 1] = "P";
                temp[3][col - 1] = " ";
                let wx = 0,
                  wy = 0;
                for (let i = 0; i < 8; i++) {
                  for (let j = 0; j < 8; j++) {
                    if (grid[i][j] === "K") {
                      wx = i;
                      wy = j;
                    }
                  }
                }
                if (!checkcheck(temp, wx, wy)) newGrid[2][col - 1] = ".";
              }
            }
            if (col <= 6 && newGrid[row][col + 1] === "p") {
              if (
                moves[moves.length - 1][1] ===
                `${String.fromCharCode(col + 1 + 97)}${5}`
              ) {
                let temp = grid.map((row) => [...row]);
                temp[row][col] = " ";
                temp[2][col + 1] = "P";
                temp[3][col + 1] = " ";
                let wx = 0,
                  wy = 0;
                for (let i = 0; i < 8; i++) {
                  for (let j = 0; j < 8; j++) {
                    if (grid[i][j] === "K") {
                      wx = i;
                      wy = j;
                    }
                    if (temp[i][j] === ".") temp[i][j] = " ";
                    else if (temp[i][j][0] === "x") temp[i][j] = temp[i][j][1];
                  }
                }
                if (!checkcheck(temp, wx, wy)) newGrid[2][col + 1] = ".";
              }
            }
          } else return;
        } else {
          if (row === 4) {
            if (col >= 1 && newGrid[row][col - 1] === "P") {
              if (
                moves[moves.length - 1][0] ===
                `${String.fromCharCode(col - 1 + 97)}${4}`
              ) {
                let temp = grid.map((row) => [...row]);
                temp[4][col - 1] = "p";
                temp[5][col - 1] = " ";
                let wx = 0,
                  wy = 0;
                for (let i = 0; i < 8; i++) {
                  for (let j = 0; j < 8; j++) {
                    if (grid[i][j] === "k") {
                      wx = i;
                      wy = j;
                    }
                  }
                }
                if (!checkcheck(temp, wx, wy)) newGrid[5][col - 1] = ".";
              }
            }
            if (col <= 6 && newGrid[row][col + 1] === "P") {
              if (
                moves[moves.length - 1][0] ===
                `${String.fromCharCode(col + 1 + 97)}${4}`
              ) {
                let temp = grid.map((row) => [...row]);
                temp[4][col + 1] = "P";
                temp[5][col + 1] = " ";
                let wx = 0,
                  wy = 0;
                for (let i = 0; i < 8; i++) {
                  for (let j = 0; j < 8; j++) {
                    if (grid[i][j] === "k") {
                      wx = i;
                      wy = j;
                    }
                  }
                }
                if (!checkcheck(temp, wx, wy)) newGrid[5][col + 1] = ".";
              }
            }
          } else return;
        }
      }
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (newGrid[i][j] === ".") newGrid[i][j] = " ";
          else if (newGrid[i][j][0] === "x") newGrid[i][j] = newGrid[i][j][1];
        }
      }
      if (value === "K" || value === "k") {
        let moves = [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
          [1, 1],
          [-1, -1],
          [-1, 1],
          [1, -1],
        ];
        for (let i = 0; i < 8; i++) {
          let p = row + moves[i][0],
            q = col + moves[i][1];
          if (p < 0 || p > 7 || q < 0 || q > 7) continue;
          if (newGrid[p][q] === " ") newGrid[p][q] = ".";
          else if (
            (whitePieces.includes(newGrid[p][q]) && turn === false) ||
            (turn && blackPieces.includes(newGrid[p][q]))
          )
            newGrid[p][q] = "x" + newGrid[p][q];
        }
        checkCastle();
      } else if (value === "Q" || value === "q") {
        diagonalMoves();
        verticalMoves();
      } else if (value === "P" || value === "p") {
        if (turn) {
          if (newGrid[row - 1][col] === " ") {
            newGrid[row - 1][col] = ".";
            if (row === 6 && newGrid[row - 2][col] === " ")
              newGrid[row - 2][col] = ".";
          }
          if (blackPieces.includes(newGrid[row - 1][col - 1]))
            newGrid[row - 1][col - 1] = "x" + newGrid[row - 1][col - 1];
          if (blackPieces.includes(newGrid[row - 1][col + 1]))
            newGrid[row - 1][col + 1] = "x" + newGrid[row - 1][col + 1];
        } else {
          if (newGrid[row + 1][col] === " ") {
            newGrid[row + 1][col] = ".";
            if (row === 1 && newGrid[row + 2][col] === " ")
              newGrid[row + 2][col] = ".";
          }
          if (whitePieces.includes(newGrid[row + 1][col - 1]))
            newGrid[row + 1][col - 1] = "x" + newGrid[row + 1][col - 1];
          if (whitePieces.includes(newGrid[row + 1][col + 1]))
            newGrid[row + 1][col + 1] = "x" + newGrid[row + 1][col + 1];
        }
      } else if (value === "b" || value === "B") {
        diagonalMoves();
      } else if (value === "R" || value === "r") {
        verticalMoves();
      } else if (value === "N" || value === "n") {
        const moves = [
          [1, 2],
          [2, 1],
          [2, -1],
          [1, -2],
          [-1, 2],
          [-2, 1],
          [-1, -2],
          [-2, -1],
        ];
        for (let i = 0; i < moves.length; i++) {
          let row1 = moves[i][0] + row,
            col1 = moves[i][1] + col;
          if (row1 <= 7 && col1 <= 7 && row1 >= 0 && col1 >= 0) {
            if (newGrid[row1][col1] === " ") {
              newGrid[row1][col1] = ".";
            } else {
              if (
                (turn && blackPieces.includes(newGrid[row1][col1])) ||
                (turn === false && whitePieces.includes(newGrid[row1][col1]))
              )
                newGrid[row1][col1] = "x" + newGrid[row1][col1];
            }
          }
        }
      }
      newGrid = removeBadMoves(newGrid, row, col);
      enPassant();
      setSelectedIndex([row, col]);
    } else {
      if (
        newGrid[selectedIndex[0]][selectedIndex[1]].toLocaleLowerCase() ===
          "p" &&
        ((turn && selectedIndex[0] === 1) || (!turn && selectedIndex[0] === 6))
      ) {
        setPromotionCol(col);
        setPromotionrow(row);
        setShowPromotionModal(true);
      } else if (
        newGrid[selectedIndex[0]][selectedIndex[1]].toLocaleLowerCase() ===
          "p" &&
        ((turn && selectedIndex[0] === 3 && row === 2) ||
          (!turn && selectedIndex[0] === 4 && row === 5)) &&
        (col === selectedIndex[1] - 1 || col === selectedIndex[1] + 1) &&
        newGrid[row][col] === "."
      ) {
        if (turn) newGrid[row][col] = "P";
        else newGrid[row][col] = "p";
        newGrid[selectedIndex[0]][col] = " ";
        newGrid[selectedIndex[0]][selectedIndex[1]] = " ";
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            if (newGrid[i][j] === ".") newGrid[i][j] = " ";
            else if (newGrid[i][j][0] === "x") newGrid[i][j] = newGrid[i][j][1];
          }
        }
        if (turn)
          setMoves([
            ...moves,
            [String.fromCharCode(col + 97) + (7 - row + 1).toString(), "-"],
          ]);
        else
          setMoves([
            ...moves.slice(0, moves.length - 1),
            [
              moves[moves.length - 1][0],
              String.fromCharCode(col + 97) + (7 - row + 1).toString(),
            ],
          ]);
        setTurn(!turn);
        setSelectedIndex([row, col]);
      } else {
        newGrid[row][col] = newGrid[selectedIndex[0]][selectedIndex[1]];
        newGrid[selectedIndex[0]][selectedIndex[1]] = " ";
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            if (newGrid[i][j] === ".") newGrid[i][j] = " ";
            else if (newGrid[i][j][0] === "x") newGrid[i][j] = newGrid[i][j][1];
          }
        }
        if (newGrid[row][col].toLocaleLowerCase() === "k") {
          if (row === selectedIndex[0]) {
            if (turn) {
              if (row === 7) {
                if (col === selectedIndex[1] - 2) {
                  newGrid[7][0] = " ";
                  newGrid[7][3] = "R";
                } else if (col === selectedIndex[1] + 2) {
                  newGrid[7][7] = " ";
                  newGrid[7][5] = "R";
                }
              }
            } else {
              if (row === 0) {
                if (col === selectedIndex[1] - 2) {
                  newGrid[0][0] = " ";
                  newGrid[0][3] = "r";
                } else if (col === selectedIndex[1] + 2) {
                  newGrid[0][7] = " ";
                  newGrid[0][5] = "r";
                }
              }
            }
          }
        }
        if (turn)
          setMoves([
            ...moves,
            [
              (newGrid[row][col].toLocaleLowerCase() === "p"
                ? ""
                : `${newGrid[row][col].toLocaleLowerCase()}${
                    grid[row][col][0] === "x" ? "x" : ""
                  }`) +
                String.fromCharCode(col + 97) +
                (7 - row + 1).toString(),
              "-",
            ],
          ]);
        else
          setMoves([
            ...moves.slice(0, moves.length - 1),
            [
              moves[moves.length - 1][0],
              (newGrid[row][col].toLocaleLowerCase() === "p"
                ? ""
                : `${newGrid[row][col].toLocaleLowerCase()}${
                    grid[row][col][0] === "x" ? "x" : ""
                  }`) +
                String.fromCharCode(col + 97) +
                (7 - row + 1).toString(),
            ],
          ]);
        setTurn(!turn);
        setSelectedIndex([row, col]);
      }
    }
    setGrid(newGrid);
  }

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

  return (
    <div className="chess-page">
      {showPromotionModal && (
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
      )}
      <div className="chess-container">
        <div className="chess-players">
          <div className={(turn===false) + "-player"}>
            {player2}
            {timer2 !== null &&
              !Number.isNaN(timer2) &&
              timer2 !== 0 &&
              " - " +
                `${Math.floor(timer2 / 120)}:${
                  Math.floor(((timer2 / 2) % 60) / 10) === 0 ? "0" : ""
                }${(timer2 / 2) % 60}`}
          </div>
          <div className={turn  + "-player"}>
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
                onClick={gridFunction}
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

function Move({ number, Wmove, Bmove }) {
  return (
    <div className="move-item">
      <div style={{ width: "10%" }}>{number}</div>
      <div style={{ width: "20%" }}>{Wmove}</div>
      <div style={{ width: "20%" }}>{Bmove}</div>
    </div>
  );
}
