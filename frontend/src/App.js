import './App.css';
import Chessboard from './chessboard.tsx'
import PlayChess from './playChess.tsx';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlayChess />} />
        <Route path="/friend/:player1?/:player2?/:time?" element={<Chessboard />} />
        {/* <Route path="/computer" element={<Chessboard />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
