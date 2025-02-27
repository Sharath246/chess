export const whitePieces = ["K", "Q", "R", "B", "N", "P"];
export const blackPieces = ["k", "q", "r", "b", "n", "p"];

export function checkcheck(
  grid: string[][],
  x: number,
  y: number,
  turn: boolean
) {
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
      return true;
    }
  }
  for (let i = 0; i < horses.length; i++) {
    let p = x + horses[i][0],
      q = y + horses[i][1];
    if (p < 0 || q < 0 || p > 7 || q > 7) continue;
    if ((turn && grid[p][q] === "n") || (!turn && grid[p][q] === "N")) {
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
    return true;
  }
  return false;
}

export function removeBadMoves(
  grid: string[][],
  row: number,
  col: number,
  turn: boolean
): string[][] {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (grid[i][j] === "." || grid[i][j][0] === "x") {
        let newGrid = structuredClone(grid);
        newGrid[i][j] = newGrid[row][col];
        newGrid[row][col] = " ";
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            if (newGrid[i][j] === ".") newGrid[i][j] = " ";
            else if (newGrid[i][j][0] === "x") newGrid[i][j] = newGrid[i][j][1];
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
          if (checkcheck(newGrid, wx, wy, turn)) {
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
          if (checkcheck(newGrid, bx, by, turn)) {
            if (grid[i][j][0] === "x") grid[i][j] = grid[i][j][1];
            else grid[i][j] = " ";
          }
        }
      }
    }
  }
  return grid;
}

export function clearGrid(grid: string[][]) {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (grid[i][j] === ".") grid[i][j] = " ";
      else if (grid[i][j][0] === "x") grid[i][j] = grid[i][j][1];
    }
  }
  return grid;
}

export function verticalMoves(
  row: number,
  col: number,
  grid: string[][],
  turn: boolean
) {
  let p = row + 1,
    q = 0;
  while (p <= 7) {
    if (grid[p][col] === " ") grid[p][col] = ".";
    else if (
      (whitePieces.includes(grid[p][col]) && turn === false) ||
      (turn && blackPieces.includes(grid[p][col]))
    ) {
      grid[p][col] = "x" + grid[p][col];
      break;
    } else break;
    p++;
  }
  p = row - 1;
  while (p >= 0) {
    if (grid[p][col] === " ") grid[p][col] = ".";
    else if (
      (whitePieces.includes(grid[p][col]) && turn === false) ||
      (turn && blackPieces.includes(grid[p][col]))
    ) {
      grid[p][col] = "x" + grid[p][col];
      break;
    } else break;
    p--;
  }
  q = col - 1;
  while (q >= 0) {
    if (grid[row][q] === " ") grid[row][q] = ".";
    else if (
      (whitePieces.includes(grid[row][q]) && turn === false) ||
      (turn && blackPieces.includes(grid[row][q]))
    ) {
      grid[row][q] = "x" + grid[row][q];
      break;
    } else break;
    q--;
  }
  q = col + 1;
  while (q <= 7) {
    if (grid[row][q] === " ") grid[row][q] = ".";
    else if (
      (whitePieces.includes(grid[row][q]) && turn === false) ||
      (turn && blackPieces.includes(grid[row][q]))
    ) {
      grid[row][q] = "x" + grid[row][q];
      break;
    } else break;
    q++;
  }
  return grid;
}

export function diagonalMoves(
  row: number,
  col: number,
  grid: string[][],
  turn: boolean
) {
  let rownum = row - 1,
    colnum = col - 1;
  while (rownum >= 0 && colnum >= 0) {
    if (grid[rownum][colnum] === " ") grid[rownum][colnum] = ".";
    else if (
      (blackPieces.includes(grid[rownum][colnum]) && turn) ||
      (whitePieces.includes(grid[rownum][colnum]) && turn === false)
    ) {
      grid[rownum][colnum] = "x" + grid[rownum][colnum];
      break;
    } else break;
    rownum--;
    colnum--;
  }
  rownum = row + 1;
  colnum = col + 1;
  while (rownum < 8 && colnum < 8) {
    if (grid[rownum][colnum] === " ") grid[rownum][colnum] = ".";
    else if (
      (blackPieces.includes(grid[rownum][colnum]) && turn) ||
      (whitePieces.includes(grid[rownum][colnum]) && turn === false)
    ) {
      grid[rownum][colnum] = "x" + grid[rownum][colnum];
      break;
    } else break;
    rownum++;
    colnum++;
  }
  rownum = row + 1;
  colnum = col - 1;
  while (rownum < 8 && colnum >= 0) {
    if (grid[rownum][colnum] === " ") grid[rownum][colnum] = ".";
    else if (
      (blackPieces.includes(grid[rownum][colnum]) && turn) ||
      (whitePieces.includes(grid[rownum][colnum]) && turn === false)
    ) {
      grid[rownum][colnum] = "x" + grid[rownum][colnum];
      break;
    } else break;
    rownum++;
    colnum--;
  }
  rownum = row - 1;
  colnum = col + 1;
  while (rownum >= 0 && colnum < 8) {
    if (grid[rownum][colnum] === " ") grid[rownum][colnum] = ".";
    else if (
      (blackPieces.includes(grid[rownum][colnum]) && turn) ||
      (whitePieces.includes(grid[rownum][colnum]) && turn === false)
    ) {
      grid[rownum][colnum] = "x" + grid[rownum][colnum];
      break;
    } else break;
    rownum--;
    colnum++;
  }
  return grid;
}

export function checkCastle(
  turn: boolean,
  moves: string[][],
  newGrid: string[][]
) {
  let grid = structuredClone(newGrid);
  grid = structuredClone(clearGrid(grid));
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
          (a.endsWith("g1") || a.endsWith("f1") || a[a.length - 1] === "h")
        )
          r2 = 0;
        else if (
          a.startsWith("r") &&
          (a.endsWith("b1") ||
            a.endsWith("c1") ||
            a.endsWith("d1") ||
            a[a.length - 1] === "a")
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
            let tempGrid = structuredClone(grid);
            tempGrid[7][i] = "K";
            if (i !== 4) tempGrid[7][4] = " ";
            if (checkcheck(tempGrid, 7, i, turn)) {
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
            let tempGrid = structuredClone(grid);
            tempGrid[7][i] = "K";
            if (i !== 4) tempGrid[7][4] = " ";
            if (checkcheck(tempGrid, 7, i, turn)) {
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
          (a.endsWith("e8") || a.endsWith("f8") || a[a.length - 1] === "h")
        )
          r2 = 0;
        else if (
          a.startsWith("r") &&
          (a.endsWith("b8") ||
            a.endsWith("c8") ||
            a.endsWith("d8") ||
            a[a.length - 1] === "a")
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
            let tempGrid = structuredClone(grid);
            tempGrid[0][i] = "k";
            if (i !== 4) tempGrid[0][4] = " ";
            if (checkcheck(tempGrid, 0, i, turn)) {
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
            let tempGrid = structuredClone(grid);
            tempGrid[0][i] = "k";
            if (i !== 4) tempGrid[0][4] = " ";
            if (checkcheck(tempGrid, 0, i, turn)) {
              r2 = 0;
              break;
            }
          }
          if (r2) newGrid[0][6] = ".";
        }
      }
    }
  }

  return newGrid;
}

export function kingMoves(
  row: number,
  col: number,
  grid: string[][],
  turn: boolean
) {
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
    if (grid[p][q] === " ") grid[p][q] = ".";
    else if (
      (whitePieces.includes(grid[p][q]) && turn === false) ||
      (turn && blackPieces.includes(grid[p][q]))
    )
      grid[p][q] = "x" + grid[p][q];
  }
  return grid;
}

export function enPassant(
  turn: boolean,
  row: number,
  col: number,
  moves: string[][],
  newGrid: string[][]
) {
  let grid = structuredClone(newGrid);
  grid = structuredClone(clearGrid(grid));
  if (turn) {
    if (row === 3) {
      if (col >= 1 && newGrid[row][col - 1] === "p") {
        if (
          moves[moves.length - 1][1] ===
          `${String.fromCharCode(col - 1 + 97)}${5}`
        ) {
          let temp = structuredClone(grid);
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
          if (!checkcheck(temp, wx, wy, turn)) newGrid[2][col - 1] = ".";
        }
      }
      if (col <= 6 && newGrid[row][col + 1] === "p") {
        if (
          moves[moves.length - 1][1] ===
          `${String.fromCharCode(col + 1 + 97)}${5}`
        ) {
          let temp = structuredClone(grid);
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
          if (!checkcheck(temp, wx, wy, turn)) newGrid[2][col + 1] = ".";
        }
      }
    } else return newGrid;
  } else {
    if (row === 4) {
      if (col >= 1 && newGrid[row][col - 1] === "P") {
        if (
          moves[moves.length - 1][0] ===
          `${String.fromCharCode(col - 1 + 97)}${4}`
        ) {
          let temp = structuredClone(grid);
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
          if (!checkcheck(temp, wx, wy, turn)) newGrid[5][col - 1] = ".";
        }
      }
      if (col <= 6 && newGrid[row][col + 1] === "P") {
        if (
          moves[moves.length - 1][0] ===
          `${String.fromCharCode(col + 1 + 97)}${4}`
        ) {
          let temp = structuredClone(grid);
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
          if (!checkcheck(temp, wx, wy, turn)) newGrid[5][col + 1] = ".";
        }
      }
    } else return newGrid;
  }
  return newGrid;
}

export function pawnMoves(
  row: number,
  col: number,
  turn: boolean,
  grid: string[][]
) {
  if (turn) {
    if (grid[row - 1][col] === " ") {
      grid[row - 1][col] = ".";
      if (row === 6 && grid[row - 2][col] === " ") {
        grid[row - 2][col] = ".";
      }
    }
    if (col > 0 && blackPieces.includes(grid[row - 1][col - 1])) {
      grid[row - 1][col - 1] = "x" + grid[row - 1][col - 1];
    }
    if (col < 7 && blackPieces.includes(grid[row - 1][col + 1])) {
      grid[row - 1][col + 1] = "x" + grid[row - 1][col + 1];
    }
  } else {
    if (grid[row + 1][col] === " ") {
      grid[row + 1][col] = ".";
      if (row === 1 && grid[row + 2][col] === " ") {
        grid[row + 2][col] = ".";
      }
    }
    if (col > 0 && whitePieces.includes(grid[row + 1][col - 1])) {
      grid[row + 1][col - 1] = "x" + grid[row + 1][col - 1];
    }
    if (col < 7 && whitePieces.includes(grid[row + 1][col + 1])) {
      grid[row + 1][col + 1] = "x" + grid[row + 1][col + 1];
    }
  }

  return grid;
}

export function knightMoves(
  row: number,
  col: number,
  grid: string[][],
  turn: boolean
) {
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
      if (grid[row1][col1] === " ") {
        grid[row1][col1] = ".";
      } else {
        if (
          (turn && blackPieces.includes(grid[row1][col1])) ||
          (turn === false && whitePieces.includes(grid[row1][col1]))
        )
          grid[row1][col1] = "x" + grid[row1][col1];
      }
    }
  }
  return grid;
}

export function moveFunction(
  row: number,
  col: number,
  grid: string[][],
  newGrid: string[][],
  setMoves: React.Dispatch<React.SetStateAction<string[][]>>,
  selectedIndex: number[],
  setSelectedIndex: React.Dispatch<React.SetStateAction<number[]>>,
  setPromotionCol: React.Dispatch<React.SetStateAction<number>>,
  setPromotionrow: React.Dispatch<React.SetStateAction<number>>,
  setShowPromotionModal: React.Dispatch<React.SetStateAction<boolean>>,
  turn: boolean,
  setTurn: React.Dispatch<React.SetStateAction<boolean>>,
  sendMessage?: (grid: string[][],move:string) => void
) {
  if (
    newGrid[selectedIndex[0]][selectedIndex[1]].toLocaleLowerCase() === "p" &&
    ((turn && selectedIndex[0] === 1) || (!turn && selectedIndex[0] === 6))
  ) {
    setPromotionCol(col);
    setPromotionrow(row);
    setShowPromotionModal(true);
  } else if (
    newGrid[selectedIndex[0]][selectedIndex[1]].toLocaleLowerCase() === "p" &&
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
    if (turn){
      setMoves((prev)=>{return [
        ...prev,
        [String.fromCharCode(col + 97) + (7 - row + 1).toString(), "-"],
      ]});
      sendMessage && sendMessage(
        newGrid,
        String.fromCharCode(col + 97) + (7 - row + 1).toString()
      );
    }
    else{
      setMoves((prev)=>{return [
        ...prev.slice(0, prev.length - 1),
        [
          prev[prev.length - 1][0],
          String.fromCharCode(col + 97) + (7 - row + 1).toString(),
        ],
      ]});
      sendMessage && sendMessage(
        newGrid,
        String.fromCharCode(col + 97) + (7 - row + 1).toString()
      );
    }
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
    if (turn){
      setMoves((prev)=>{return [
        ...prev,
        [
          (`${newGrid[row][col].toLocaleLowerCase()}${
                grid[row][col][0] === "x" ? "x" : ""
              }` +
            String.fromCharCode(col + 97) +
            (7 - row + 1).toString()).replace('p',''),
          "-",
        ],
      ]});
      sendMessage && sendMessage(
        newGrid,
        (
          `${newGrid[row][col].toLocaleLowerCase()}${
            grid[row][col][0] === "x" ? "x" : ""
          }` +
          String.fromCharCode(col + 97) +
          (7 - row + 1).toString()
        ).replace("p", "")
      );
    }
    else{
      setMoves((prev)=>{return [
        ...prev.slice(0, prev.length - 1),
        [
          prev[prev.length - 1][0],
          (`${newGrid[row][col].toLocaleLowerCase()}${
                grid[row][col][0] === "x" ? "x" : ""
              }` +
            String.fromCharCode(col + 97) +
            (7 - row + 1).toString()).replace('p',''),
        ],
      ]});
      sendMessage && sendMessage(
        newGrid,
        (
          `${newGrid[row][col].toLocaleLowerCase()}${
            grid[row][col][0] === "x" ? "x" : ""
          }` +
          String.fromCharCode(col + 97) +
          (7 - row + 1).toString()
        ).replace("p", "")
      );
    }
    setTurn(!turn);
    setSelectedIndex([row, col]);
  }
  return newGrid;
}
