import React from "react";
import "./LoadingScreen.css";

const LoadingScreen = ({ message = "Searching For an Opponent" }) => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-text">{message}</p>
    </div>
  );
};

export default LoadingScreen;
