import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import './playChess.css'

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [time, setTime] = useState(5);
  const navigate = useNavigate();

  const handleStartGame = (time:number) => {
    setShowModal(false);
    navigate(`/friend/${time*60}`);
  };

  return (
    <div className="home-page">
      <h1 className="home-title">Welcome to Chess</h1>
      <div className="button-container">
        <button className="home-button" onClick={() => setShowModal(true)}>
          Play with Friend
        </button>
        <button
          disabled={true}
          className="home-button"
          onClick={() => navigate("/game/computer")}
        >
          Play with Computer
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Set Game Time</h2>
            <input
              type="number"
              min="1"
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              className="time-input"
            />
            <button className="confirm-button" onClick={()=>{handleStartGame(time)}}>
              Start Game
            </button>
            <button className="confirm-button" onClick={()=>{handleStartGame(0)}}>
              No Time Limit
            </button>
            <button
              className="cancel-button"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
