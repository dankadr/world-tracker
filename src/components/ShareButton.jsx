import { useState } from 'react';
import { countryList } from '../data/countries';
import { encodeShareData } from '../utils/shareUrl';

const STORAGE_PREFIX = 'swiss-tracker-visited-';

function buildShareData() {
  const data = {};
  for (const c of countryList) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + c.id);
      if (raw) {
        const parsed = JSON.parse(raw);
        const ids = Array.isArray(parsed) ? parsed : Object.keys(parsed);
        if (ids.length > 0) data[c.id] = ids;
      }
    } catch { /* ignore */ }
  }
  return data;
}

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const data = buildShareData();
    if (Object.keys(data).length === 0) return;

    const encoded = encodeShareData(data);
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;

    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback: prompt
      prompt('Copy this share link:', url);
    });
  };

  return (
    <button className="share-btn" onClick={handleShare} title="Share your progress">
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Link copied!
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}
