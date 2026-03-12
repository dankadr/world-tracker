import { useTheme } from '../context/ThemeContext';
import './SettingsPanel.css';

const APP_VERSION = '1.0.0';

export default function SettingsPanel({ onReset, onResetAll, onShowOnboarding, onOpenAdmin }) {
  const { dark, toggle: toggleTheme } = useTheme();

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <p className="settings-section-label">Appearance</p>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">🌙</span>
              <span className="settings-row-title">Dark Mode</span>
            </div>
            <button
              className={`settings-toggle ${dark ? 'on' : ''}`}
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <p className="settings-section-label">Data</p>
        <div className="settings-group">
          {onShowOnboarding && (
            <>
              <button className="settings-row settings-row-btn" onClick={onShowOnboarding}>
                <div className="settings-row-left">
                  <span className="settings-row-icon">📖</span>
                  <span className="settings-row-title">Show Onboarding</span>
                </div>
                <span className="settings-row-chevron">›</span>
              </button>
              <div className="settings-row-divider" />
            </>
          )}
          {onReset && (
            <>
              <button className="settings-row settings-row-btn settings-row-danger" onClick={onReset}>
                <div className="settings-row-left">
                  <span className="settings-row-icon">🗑️</span>
                  <span className="settings-row-title">Reset Current Tracker</span>
                </div>
                <span className="settings-row-chevron">›</span>
              </button>
              <div className="settings-row-divider" />
            </>
          )}
          {onResetAll && (
            <button className="settings-row settings-row-btn settings-row-danger" onClick={onResetAll}>
              <div className="settings-row-left">
                <span className="settings-row-icon">🗑️</span>
                <span className="settings-row-title">Reset Everything</span>
              </div>
              <span className="settings-row-chevron">›</span>
            </button>
          )}
        </div>
      </div>

      {onOpenAdmin && (
        <div className="settings-section">
          <p className="settings-section-label">Admin</p>
          <div className="settings-group">
            <button className="settings-row settings-row-btn" onClick={onOpenAdmin}>
              <div className="settings-row-left">
                <span className="settings-row-icon">⚙️</span>
                <span className="settings-row-title">Admin Panel</span>
              </div>
              <span className="settings-row-chevron">›</span>
            </button>
          </div>
        </div>
      )}

      <div className="settings-section">
        <p className="settings-section-label">About</p>
        <div className="settings-group">
          <a
            className="settings-row settings-row-btn"
            href="https://rightworldtracker.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">🌐</span>
              <span className="settings-row-title">Website</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </a>
          <div className="settings-row-divider" />
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">ℹ️</span>
              <span className="settings-row-title">Version</span>
            </div>
            <span className="settings-row-value">{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
