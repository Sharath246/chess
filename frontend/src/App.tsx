import './App.css';
import React from 'react';
import Chessboard from './chessboard.tsx'
import PlayChess from './playChess.tsx';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OnlineGame from './online-game.tsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlayChess />} />
        <Route
          path="/friend/:player1?/:player2?/:time?"
          element={
            <Chessboard onlineGame={false}/>
          }
        />
        <Route path="/online" element={<Chessboard onlineGame={true} />} />
        {/* <Route path="/computer" element={<Chessboard />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
