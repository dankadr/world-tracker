import { useState, useEffect } from 'react';
import './InstallPrompt.css';

const DISMISSED_KEY = 'pwa-install-dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Install app">
      <div className="install-prompt-content">
        <img src="/logo.png" alt="" className="install-prompt-icon" />
        <div className="install-prompt-text">
          <strong>Add to Home Screen</strong>
          <span>Install Right World Tracker for quick access</span>
        </div>
        <button className="install-prompt-btn install-prompt-install" onClick={handleInstall}>
          Install
        </button>
        <button className="install-prompt-btn install-prompt-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
