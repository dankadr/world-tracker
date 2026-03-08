import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { FriendsProvider } from './context/FriendsContext';
import { ThemeProvider } from './context/ThemeContext';
import { XpProvider } from './hooks/useXp';
import { NavigationProvider } from './context/NavigationContext';
import './App.css';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Only enable Sentry when a DSN is configured
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <XpProvider>
          <FriendsProvider>
            <NavigationProvider>
              <App />
            </NavigationProvider>
          </FriendsProvider>
        </XpProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
