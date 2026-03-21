import { useState, useEffect } from 'react';
import './OfflineIndicator.css';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-indicator" role="status" aria-live="polite">
      <span className="offline-indicator-icon">📡</span>
      <span>Offline — changes will sync when reconnected</span>
    </div>
  );
}
