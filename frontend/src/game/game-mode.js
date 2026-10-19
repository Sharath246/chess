import { useState } from "react";
import { GameMode } from "../utils/constants";

const GameModeScreen = ({ onSelect }) => {
  const [selectedMode, setSelectedMode] = useState(null);
  const username = sessionStorage.getItem("username") || "player";

  const chooseMode = (mode) => {
    setSelectedMode(mode);
    onSelect(mode);
  };

  return (
    <main className="mode-page">
      <section className="mode-panel">
        <span className="waiting-kicker">CHESS ARENA</span>
        <p className="welcome-message">Welcome, {username}</p>
        <h1>Choose your game</h1>
        <p>Play on one board with a friend, or find a random opponent online.</p>
        <div className="mode-options">
          <button
            className={selectedMode === GameMode.LOCAL ? "mode-option selected" : "mode-option"}
            type="button"
            onClick={() => chooseMode(GameMode.LOCAL)}
          >
            <strong>Two players</strong>
            <span>Pass the board between two players on this device.</span>
          </button>
          <button
            className={selectedMode === GameMode.ONLINE ? "mode-option selected" : "mode-option"}
            type="button"
            onClick={() => chooseMode(GameMode.ONLINE)}
          >
            <strong>Online match</strong>
            <span>Wait for the backend to find a random opponent.</span>
          </button>
        </div>
      </section>
    </main>
  );
};

export default GameModeScreen;