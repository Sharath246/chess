import TimerIcon from '@mui/icons-material/Timer';
import { useEffect, useRef, useState } from "react"

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
};

export const Timer = ({ activeColor, gameOver, onTimeout }) => {
    const [whiteTime, setWhiteTime] = useState(300);
    const [blackTime, setBlackTime] = useState(300);
    const whiteTimeRef = useRef(300);
    const blackTimeRef = useRef(300);

    useEffect(() => {
        if (gameOver) return undefined;

        const timer = setInterval(() => {
            if (activeColor === "w") {
                if (whiteTimeRef.current <= 1) {
                    whiteTimeRef.current = 0;
                    setWhiteTime(0);
                    onTimeout?.("w");
                    return;
                }
                whiteTimeRef.current -= 1;
                setWhiteTime(whiteTimeRef.current);
            } else {
                if (blackTimeRef.current <= 1) {
                    blackTimeRef.current = 0;
                    setBlackTime(0);
                    onTimeout?.("b");
                    return;
                }
                blackTimeRef.current -= 1;
                setBlackTime(blackTimeRef.current);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [activeColor, gameOver, onTimeout]);

    return (
        <section className="clock-panel" aria-label="Game clocks">
            <div className={`clock-card ${activeColor === "w" ? "active" : ""}`}>
                <div className="clock-player">
                    <span className="player-token light-token" />
                    <span>White</span>
                </div>
                <strong className="clock-time">{formatTime(whiteTime)}</strong>
            </div>
            <div className={`clock-card ${activeColor === "b" ? "active" : ""}`}>
                <div className="clock-player">
                    <span className="player-token dark-token" />
                    <span>Black</span>
                </div>
                <strong className="clock-time">{formatTime(blackTime)}</strong>
            </div>
            <div className="clock-caption"><TimerIcon fontSize="inherit" /> 5 minute game</div>
        </section>
    )
}