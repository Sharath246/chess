import "./App.css";
import React from "react";
import Chessboard from "./chessboard.tsx";
import PlayChess from "./playChess.tsx";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OnlineGame from "./online-game.tsx";
// import ComputerGame from "./computerGame.tsx";
import FenViewer from "./computerGame.tsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlayChess />} />
        <Route
          path="/friend/:player1?/:player2?/:time?"
          element={<Chessboard gameType={"2Player"} />}
        />
        <Route path="/online" element={<Chessboard gameType={"Online"} />} />
        <Route path="/computer" element={<Chessboard gameType={"Computer"} />} />
      </Routes>
    </Router>
  );
}

export default App;
