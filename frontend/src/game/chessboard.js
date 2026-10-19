import { Box, styled } from "@mui/material";

const BoardFrame = styled(Box)({
  width: "min(90vh, 90vw, 100%)",
  height: "auto",
  maxWidth: "100%",
  maxHeight: "100%",
  aspectRatio: "1",
  padding: 12,
  boxSizing: "border-box",
  backgroundColor: "#2e2e2e",
  boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)",
});

const SquareGrid = styled(Box)({
  display: "grid",
  gridTemplateColumns: "repeat(8, 1fr)",
  gridTemplateRows: "repeat(8, 1fr)",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  borderRadius: 4,
});

const Square = styled(Box)(({ light, selected, checked, playable, occupied }) => ({
  display: "grid",
  placeItems: "center",
  position: "relative",
  boxSizing: "border-box",
  backgroundColor: selected
    ? (light ? "#e7c875" : "#b58b3e")
    : checked ? "#f3b6ae"
      : light ? "#e8dfc8" : "#54746d",
  boxShadow: selected ? "inset 0 0 0 3px rgba(255, 248, 214, .9)" : "none",
  cursor: "pointer",
  transition: "background-color .2s ease, box-shadow .2s ease, transform .2s ease",
  "&:hover": {
    backgroundColor: selected
      ? (light ? "#e7c875" : "#b58b3e")
      : (light ? "#f1e8d2" : "#668b82"),
  },
  "&::after": playable ? {
    content: '""',
    position: "absolute",
    width: occupied ? "78%" : "22%",
    height: occupied ? "78%" : "22%",
    borderRadius: "50%",
    border: occupied ? "3px solid rgba(183, 67, 54, .82)" : "none",
    backgroundColor: occupied ? "transparent" : "rgba(42, 55, 50, .38)",
    pointerEvents: "none",
  } : {},
}));

const expandRank = (rank) => [...rank].flatMap((cell) =>
  /[1-8]/.test(cell) ? Array(Number(cell)).fill(" ") : [cell]
);

const parseBoard = (fen, playingAs) => {
  const ranks = fen.split("/").map(expandRank);
  return playingAs === "white"
    ? ranks
    : ranks.reverse().map((rank) => rank.reverse());
};

const squareName = (row, column, playingAs) => {
  const file = playingAs === "white" ? column : 7 - column;
  const rank = playingAs === "white" ? 8 - row : row + 1;
  return `${String.fromCharCode(97 + file)}${rank}`;
};

const pieceImage = (piece) => {
  const isWhite = piece === piece.toUpperCase();
  return `../pieces/${isWhite ? "w" : ""}${piece.toUpperCase()}.svg`;
};

const ChessBoard = ({
  board,
  playingAs,
  checkedKing,
  possibleMoves,
  selectedCell,
  selectedMove,
  totalMoves,
  handleSelect,
}) => {
  const orientation = playingAs === "black" ? "black" : "white";
  const squares = parseBoard(board, orientation);
  const canPlay = selectedMove === totalMoves;

  return (
    <BoardFrame>
      <SquareGrid>
        {squares.flatMap((rank, row) => rank.map((piece, column) => {
          const square = squareName(row, column, orientation);
          const isSelected = selectedCell?.position === square;
          const isPlayable = possibleMoves.includes(square);

          return (
            <Square
              key={square}
              light={(row + column) % 2 === 0}
              selected={isSelected}
              checked={checkedKing === square}
              playable={isPlayable}
              occupied={piece !== " "}
              role="button"
              tabIndex={0}
              aria-label={`Chess square ${square}`}
              onClick={() => canPlay && handleSelect(square, piece)}
              onKeyDown={(event) => {
                if (canPlay && (event.key === "Enter" || event.key === " ")) {
                  handleSelect(square, piece);
                }
              }}
            >
              {piece !== " " && <img src={pieceImage(piece)} alt={`Chess piece ${piece}`} draggable={false} />}
            </Square>
          );
        }))}
      </SquareGrid>
    </BoardFrame>
  );
};

export default ChessBoard;
