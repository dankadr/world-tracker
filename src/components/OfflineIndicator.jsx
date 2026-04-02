import { useState, useEffect, useRef } from 'react';
import { getQueuedBatchCount } from '../utils/batchQueue';
import './OfflineIndicator.css';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [queuedCount, setQueuedCount] = useState(() => getQueuedBatchCount());
  const [showOfflineReady, setShowOfflineReady] = useState(false);
  const offlineReadyTimerRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleQueueChange = (event) => {
      setQueuedCount(event.detail?.count ?? getQueuedBatchCount());
    };
    const handleOfflineReady = () => {
      clearTimeout(offlineReadyTimerRef.current);
      setShowOfflineReady(true);
      offlineReadyTimerRef.current = window.setTimeout(() => setShowOfflineReady(false), 4000);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('batchqueuechange', handleQueueChange);
    window.addEventListener('pwa:offline-ready', handleOfflineReady);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('batchqueuechange', handleQueueChange);
      window.removeEventListener('pwa:offline-ready', handleOfflineReady);
      clearTimeout(offlineReadyTimerRef.current);
    };
  }, []);

  if (!isOffline && !showOfflineReady) return null;

  const queuedLabel = queuedCount === 1 ? '1 change queued' : `${queuedCount} changes queued`;
  const message = isOffline
    ? queuedCount > 0
      ? `Offline — ${queuedLabel}; they will sync when reconnected`
      : 'Offline — changes will sync when reconnected'
    : 'Offline support is ready on this device';

  return (
    <div
      className={`offline-indicator ${showOfflineReady && !isOffline ? 'offline-indicator-ready' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="offline-indicator-icon">📡</span>
      <span>{message}</span>
    </div>
  );
}
