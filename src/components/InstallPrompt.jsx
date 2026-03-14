import { useEffect, useMemo, useState } from 'react';
import './InstallPrompt.css';

const INSTALL_STATE_KEY = 'pwa-install-state';
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function readInstallState() {
  try {
    const raw = localStorage.getItem(INSTALL_STATE_KEY);
    if (!raw) return { dismissedUntil: null, lastDismissReason: null };
    const parsed = JSON.parse(raw);
    return {
      dismissedUntil: typeof parsed.dismissedUntil === 'number' ? parsed.dismissedUntil : null,
      lastDismissReason: typeof parsed.lastDismissReason === 'string' ? parsed.lastDismissReason : null,
    };
  } catch {
    return { dismissedUntil: null, lastDismissReason: null };
  }
}

function writeInstallState(nextState) {
  localStorage.setItem(INSTALL_STATE_KEY, JSON.stringify(nextState));
}

function getMobilePlatform() {
  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && /Apple/i.test(vendor) && !/CriOS|FxiOS|EdgiOS/i.test(ua);

  if (isAndroid) return 'android';
  if (isIOS && isSafari) return 'ios-safari';
  return 'other';
}

function isStandaloneMode() {
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
  return Boolean(standaloneMedia || navigator.standalone);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(() => readInstallState().dismissedUntil);

  const platform = useMemo(() => getMobilePlatform(), []);
  const isInstallableMobile = platform === 'android' || platform === 'ios-safari';
  const isStandalone = useMemo(() => isStandaloneMode(), []);
  const canShowManualIOSPrompt = platform === 'ios-safari' && !isStandalone;
  const isCooldownActive = dismissedUntil !== null && dismissedUntil > Date.now();

  useEffect(() => {
    if (!isInstallableMobile || isStandalone || isCooldownActive) {
      setShowPrompt(false);
      return;
    }

    if (canShowManualIOSPrompt) {
      setShowPrompt(true);
    }
  }, [canShowManualIOSPrompt, isCooldownActive, isInstallableMobile, isStandalone]);

  useEffect(() => {
    if (!isInstallableMobile || isStandalone || isCooldownActive) return undefined;

    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isCooldownActive, isInstallableMobile, isStandalone]);

  function dismiss(reason) {
    const nextDismissedUntil = Date.now() + COOLDOWN_MS;
    writeInstallState({
      dismissedUntil: nextDismissedUntil,
      lastDismissReason: reason,
    });
    setDismissedUntil(nextDismissedUntil);
    setDeferredPrompt(null);
    setShowPrompt(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (choice?.outcome === 'dismissed') {
      dismiss('native-dismissed');
      return;
    }

    setShowPrompt(false);
  }

  if (!showPrompt || !isInstallableMobile || isStandalone || isCooldownActive) {
    return null;
  }

  const isNativeInstall = Boolean(deferredPrompt);

  return (
    <div className="install-prompt" role="dialog" aria-label="Install app" data-testid="install-prompt">
      <div className="install-prompt-content">
        <picture>
          <source srcSet="/logo.webp" type="image/webp" />
          <img src="/logo.png" alt="" className="install-prompt-icon" />
        </picture>

        <div className="install-prompt-body">
          <div className="install-prompt-text">
            <strong>Add Right World Tracker to your Home Screen</strong>
            <span>
              {isNativeInstall
                ? 'Install it for faster access and an app-like experience.'
                : 'Save it like an app for faster access from your phone.'}
            </span>
          </div>

          {!isNativeInstall && (
            <ol className="install-prompt-steps" data-testid="install-prompt-ios-steps">
              <li>Tap the Share button in Safari.</li>
              <li>Choose Add to Home Screen.</li>
              <li>Tap Add to place it on your phone.</li>
            </ol>
          )}
        </div>

        <div className="install-prompt-actions">
          {isNativeInstall ? (
            <button
              className="install-prompt-btn install-prompt-install"
              onClick={handleInstall}
              data-testid="install-prompt-install"
            >
              Install
            </button>
          ) : (
            <button
              className="install-prompt-btn install-prompt-ios"
              onClick={() => dismiss('ios-instructions-dismissed')}
              data-testid="install-prompt-got-it"
            >
              Got it
            </button>
          )}

          <button
            className="install-prompt-btn install-prompt-dismiss"
            onClick={() => dismiss('dismissed')}
            aria-label="Dismiss"
            data-testid="install-prompt-dismiss"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
