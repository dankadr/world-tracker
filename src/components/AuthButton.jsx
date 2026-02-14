import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthButton() {
  const { user, isLoggedIn, loading, login, logout } = useAuth();
  const googleBtnRef = useRef(null);
  const [error, setError] = useState(null);
  const [gsiReady, setGsiReady] = useState(false);

  // Wait for Google Identity Services to load
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    function checkGsi() {
      if (window.google?.accounts?.id) {
        setGsiReady(true);
      } else {
        setTimeout(checkGsi, 200);
      }
    }
    checkGsi();
  }, []);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !gsiReady || isLoggedIn) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setError(null);
        try {
          await login(response.credential);
        } catch (err) {
          setError(err.message);
        }
      },
    });

    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'medium',
        width: 260,
        text: 'signin_with',
      });
    }
  }, [gsiReady, isLoggedIn, login]);

  // No client ID configured -- hide auth entirely
  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  if (loading) {
    return (
      <div className="auth-section">
        <span className="auth-loading">Signing in...</span>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="auth-section">
        <div className="auth-user">
          {user.picture && (
            <img src={user.picture} alt="" className="auth-avatar" referrerPolicy="no-referrer" />
          )}
          <span className="auth-name">{user.name || user.email}</span>
        </div>
        <button className="auth-logout" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-section">
      <div ref={googleBtnRef} className="google-btn-wrapper" />
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
