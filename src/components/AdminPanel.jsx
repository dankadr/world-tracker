import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { triggerEncrypt, triggerDecrypt } from '../utils/api';
import './AdminPanel.css';
import './SettingsPanel.css';

export default function AdminPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(null); // 'encrypt' | 'decrypt' | null
  const [result, setResult] = useState(null);   // { type: 'success'|'error', message: string }

  async function handleEncrypt() {
    if (!window.confirm('This will encrypt all user data in the database.\n\nAre you sure?')) return;
    setLoading('encrypt');
    setResult(null);
    try {
      const data = await triggerEncrypt(token);
      const msg = `Done — ${data.encrypted} rows encrypted, ${data.skipped} skipped${data.errors > 0 ? `, ${data.errors} errors` : ''}.`;
      setResult({ type: data.errors > 0 ? 'error' : 'success', message: msg });
    } catch (err) {
      setResult({ type: 'error', message: `Failed: ${err.message}` });
    } finally {
      setLoading(null);
    }
  }

  async function handleDecrypt() {
    if (!window.confirm('This will DECRYPT all user data — removing encryption from the database.\n\nAre you sure?')) return;
    setLoading('decrypt');
    setResult(null);
    try {
      const data = await triggerDecrypt(token);
      const msg = `Done — ${data.decrypted} rows decrypted, ${data.skipped} skipped${data.errors > 0 ? `, ${data.errors} errors` : ''}.`;
      setResult({ type: data.errors > 0 ? 'error' : 'success', message: msg });
    } catch (err) {
      setResult({ type: 'error', message: `Failed: ${err.message}` });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <p className="admin-panel-title">Admin</p>
        <p className="admin-panel-subtitle">dankadr100@gmail.com</p>
      </div>

      <div className="settings-section">
        <p className="settings-section-label">Database Encryption</p>
        <div className="settings-group">
          <button
            className={`settings-row settings-row-btn${loading === 'encrypt' ? ' admin-row-loading' : ''}`}
            onClick={handleEncrypt}
            disabled={!!loading}
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">🔒</span>
              <span className="settings-row-title">Encrypt all user data</span>
            </div>
            <span className="settings-row-chevron">{loading === 'encrypt' ? '…' : '›'}</span>
          </button>
          <div className="settings-row-divider" />
          <button
            className={`settings-row settings-row-btn settings-row-danger${loading === 'decrypt' ? ' admin-row-loading' : ''}`}
            onClick={handleDecrypt}
            disabled={!!loading}
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">🔓</span>
              <span className="settings-row-title">Decrypt all user data</span>
            </div>
            <span className="settings-row-chevron">{loading === 'decrypt' ? '…' : '›'}</span>
          </button>
        </div>
        <p className="settings-footer-note">Idempotent — already-encrypted rows are skipped.</p>
      </div>

      <div className="settings-section">
        <p className="settings-section-label">More Tools</p>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">🔧</span>
              <span className="settings-row-title" style={{ opacity: 0.4 }}>Coming soon…</span>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className={`admin-result-banner ${result.type}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
