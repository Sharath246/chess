import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./playChess.css";

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("5");
  const [seconds, setSeconds] = useState("0");
  const [player1, setPlayer1] = useState("Player1");
  const [player2, setPlayer2] = useState("Player2");
  const navigate = useNavigate();

  // Function to handle input validation (allow only 2 digits)
  const handleTimeInput = (value, setter, max) => {
    if (/^\d{0,2}$/.test(value) && Number(value) <= max) {
      setter(value);
    }
  };

  const handleStartGame = (noTimeLimit = false) => {
    let totalTime = noTimeLimit
      ? 0
      : Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    setShowModal(false);
    navigate(`/friend/${player1}/${player2}/${totalTime}`);
  };

  return (
    <div className="home-page">
      <h1 className="home-title">Welcome to Chess</h1>
      <div className="button-container">
        <button className="home-button" onClick={() => setShowModal(true)}>
          Play with Friend
        </button>
        <button disabled={true} className="home-button">
          Play with Computer
        </button>
        <button className="home-button" onClick={() => navigate('/online')}>
          Play Online
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-inputs-container">
              <div className="modal-input">
                White
                <input
                  type="text"
                  maxLength={10}
                  value={player1}
                  onChange={(e) => setPlayer1(e.target.value)}
                  className="name-input"
                />
              </div>
              <div className="modal-input">
                Black
                <input
                  type="text"
                  maxLength={10}
                  value={player2}
                  onChange={(e) => setPlayer2(e.target.value)}
                  className="name-input"
                />
              </div>
              <div className="modal-input">
                Time
                <div className="modal-time-input">
                  HH
                  <input
                    type="text"
                    placeholder="HH"
                    value={hours}
                    maxLength={2}
                    onChange={(e) =>
                      handleTimeInput(e.target.value, setHours, 23)
                    }
                    className="time-input"
                  />
                  MM
                  <input
                    type="text"
                    placeholder="MM"
                    value={minutes}
                    maxLength={2}
                    onChange={(e) =>
                      handleTimeInput(e.target.value, setMinutes, 59)
                    }
                    className="time-input"
                  />
                  SS
                  <input
                    type="text"
                    placeholder="SS"
                    value={seconds}
                    maxLength={2}
                    onChange={(e) =>
                      handleTimeInput(e.target.value, setSeconds, 59)
                    }
                    className="time-input"
                  />
                </div>
              </div>
            </div>
            <button
              className="confirm-button"
              onClick={() => handleStartGame()}
            >
              Start Game
            </button>
            <button
              className="confirm-button"
              onClick={() => handleStartGame(true)}
            >
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
