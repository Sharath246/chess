import { useEffect, useRef } from "react";
import { Box, Typography, styled } from "@mui/material";

const MovesContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 18,
  width: "100%",
  minWidth: 0,
  padding: "10px 14px",
  boxSizing: "border-box",
  backgroundColor: "#314b47",
  border: "1px solid rgba(232, 223, 200, .2)",
  borderRadius: 0,
  color: "#f4efe6",
});

const MoveList = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  flex: 1,
  overflowX: "auto",
  overflowY: "hidden",
  padding: "2px 2px 5px",
  scrollbarWidth: "thin",
  scrollbarColor: "#b58b3e transparent",
});

const MoveRow = styled(Box)(({ selected }) => ({
  display: "flex",
  alignItems: "center",
  flex: "0 0 auto",
  gap: 8,
  minWidth: 76,
  padding: "8px 10px",
  borderRadius: 6,
  color: selected ? "#172321" : "#d9e1d9",
  backgroundColor: selected ? "#e7c875" : "rgba(232, 223, 200, .08)",
  fontFamily: "'Courier New', Courier, monospace",
  cursor: "pointer",
  transition: "background-color .2s ease, color .2s ease, transform .2s ease",
  "&:hover": {
    backgroundColor: selected ? "#e7c875" : "rgba(232, 223, 200, .16)",
    transform: "translateY(-1px)",
  },
}));

const Moves = ({ moves, selectedMove, onSelectMove }) => {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollLeft = listRef.current.scrollWidth;
  }, [moves.length]);

  return (
    <MovesContainer className="moves-panel">
      <div className="moves-heading">
        <div>
          <span className="panel-eyebrow">MATCH LOG</span>
          <Typography variant="h6">Game notation</Typography>
        </div>
        <span className="move-count">{moves.length} moves</span>
      </div>
      <MoveList ref={listRef} aria-label="Game moves">
        {moves.map((move, index) => (
          <MoveRow
            key={`${move}-${index}`}
            selected={selectedMove === index + 1}
            onClick={() => onSelectMove(index + 1)}
          >
            <strong>{index + 1})</strong>
            <span>{move}</span>
          </MoveRow>
        ))}
      </MoveList>
    </MovesContainer>
  );
};

export default Moves;
