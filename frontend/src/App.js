import React, { useState } from 'react';
import './App.css';
import { Provider } from 'react-redux';
import { store } from './store';
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from '@mui/material';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import OnlineGame from './game/online-game';
import Game from './game/game';
import GameModeScreen from './game/game-mode';
import { GameMode, BOTH, STATUS_SUCCESS } from './utils/constants';
import AuthScreen from './auth/auth-screen';

function HomePage() {
  const [mode, setMode] = useState(null);
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('sessionId'));

  return (
    <>
      {!sessionId && <AuthScreen onAuthenticated={setSessionId} />}
      {sessionId && !mode && <GameModeScreen onSelect={setMode} />}
      {sessionId && mode === GameMode.LOCAL && <Game playingAs={BOTH} />}
      {sessionId && mode === GameMode.ONLINE && <OnlineGame />}
    </>
  );
}

function GameRoute() {
  const { gameId: routeGameId } = useParams();
  const sessionId = sessionStorage.getItem('sessionId');
  const gameId = useSelector((state) => state.game.gameId);
  const gameStatus = useSelector((state) => state.game.gameStatus);
  const playingAs = useSelector((state) => state.game.playingAs);

  if (!sessionId) return <Navigate to="/" replace />;
  if (gameStatus !== STATUS_SUCCESS || gameId !== routeGameId) {
    return (
      <main className="waiting-page">
        <p>This game is unavailable in the current session. Rejoining games is not supported yet.</p>
      </main>
    );
  }

  return <Game playingAs={playingAs} />;
}

function App() {
  const theme = createTheme({
    typography: {
      fontFamily: "Roboto",
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          body {
            font-family: 'Roboto';
          }
        `,
      },
    },
  });

  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Provider store={store}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/:gameId" element={<GameRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Provider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
