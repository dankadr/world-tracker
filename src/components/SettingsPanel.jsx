import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import DataExport from './DataExport';
import DataImport from './DataImport';
import './SettingsPanel.css';

/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

export default function SettingsPanel({ onReset, onResetAll, onShowOnboarding, onOpenAdmin }) {
  const { dark, toggle: toggleTheme } = useTheme();
  const [dataSection, setDataSection] = useState(null); // null | 'export' | 'import'

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
          <button
            className="settings-row settings-row-btn"
            onClick={() => setDataSection(dataSection === 'export' ? null : 'export')}
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">⬇</span>
              <span className="settings-row-title">Export Data</span>
            </div>
            <span className="settings-row-chevron">{dataSection === 'export' ? '∨' : '›'}</span>
          </button>
          {dataSection === 'export' && (
            <div className="settings-inline-panel">
              <DataExport />
            </div>
          )}
          <div className="settings-row-divider" />
          <button
            className="settings-row settings-row-btn"
            onClick={() => setDataSection(dataSection === 'import' ? null : 'import')}
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">⬆</span>
              <span className="settings-row-title">Import Data</span>
            </div>
            <span className="settings-row-chevron">{dataSection === 'import' ? '∨' : '›'}</span>
          </button>
          {dataSection === 'import' && (
            <div className="settings-inline-panel">
              <DataImport onImportComplete={() => setDataSection(null)} />
            </div>
          )}
          {onReset && (
            <>
              <div className="settings-row-divider" />
              <button className="settings-row settings-row-btn settings-row-danger" onClick={onReset}>
                <div className="settings-row-left">
                  <span className="settings-row-icon">🗑️</span>
                  <span className="settings-row-title">Reset Current Tracker</span>
                </div>
                <span className="settings-row-chevron">›</span>
              </button>
            </>
          )}
          {onResetAll && (
            <>
              <div className="settings-row-divider" />
              <button className="settings-row settings-row-btn settings-row-danger" onClick={onResetAll}>
                <div className="settings-row-left">
                  <span className="settings-row-icon">🗑️</span>
                  <span className="settings-row-title">Reset Everything</span>
                </div>
                <span className="settings-row-chevron">›</span>
              </button>
            </>
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
            href="https://github.com/dankadr/world-tracker/issues/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">🐛</span>
              <span className="settings-row-title">Report a Bug</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </a>
          <div className="settings-row-divider" />
          <a
            className="settings-row settings-row-btn"
            href="https://github.com/dankadr/world-tracker/discussions/new?category=ideas"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">💬</span>
              <span className="settings-row-title">Send Feedback</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </a>
          <div className="settings-row-divider" />
          <a
            className="settings-row settings-row-btn"
            href="https://ko-fi.com/YOUR_KOFI_USERNAME"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">☕</span>
              <span className="settings-row-title">Buy Me a Tea</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </a>
          <div className="settings-row-divider" />
          <a
            className="settings-row settings-row-btn"
            href="https://github.com/dankadr/world-tracker"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">⭐</span>
              <span className="settings-row-title">Star on GitHub</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </a>
          <div className="settings-row-divider" />
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">🏷️</span>
              <span className="settings-row-title">Version</span>
            </div>
            <span className="settings-row-value">v{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
