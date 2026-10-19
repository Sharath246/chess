import React, { useState } from 'react';
import './App.css';
import { Provider } from 'react-redux';
import { store } from './store';
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from '@mui/material';
import OnlineGame from './game/online-game';
import Game from './game/game';
import GameModeScreen from './game/game-mode';
import { GameMode, BOTH } from './utils/constants';
import AuthScreen from './auth/auth-screen';

function App() {
  const [mode, setMode] = useState(null);
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('sessionId'));
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
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <Provider store={store}>
        {!sessionId && <AuthScreen onAuthenticated={setSessionId} />}
        {sessionId && !mode && <GameModeScreen onSelect={setMode} />}
        {sessionId && mode === GameMode.LOCAL && <Game playingAs={BOTH} />}
        {sessionId && mode === GameMode.ONLINE && <OnlineGame />}
      </Provider>
    </ThemeProvider>
  );
}

export default App;
