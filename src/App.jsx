import { useState, useEffect } from 'react';
import RegionMap from './components/SwissMap';
import Sidebar from './components/Sidebar';
import ExportButton from './components/ExportButton';
import useVisitedRegions from './hooks/useVisitedCantons';
import useCustomColors from './hooks/useCustomColors';
import countries from './data/countries';

function parseShareHash() {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return null;
    const encoded = hash.slice(7);
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

export default function App() {
  const [countryId, setCountryId] = useState('ch');
  const [shareData, setShareData] = useState(null);
  const { applyColors, setColor, colors } = useCustomColors();

  const rawCountry = countries[countryId];
  const country = applyColors(rawCountry);
  const { visited, toggle, reset, dates, setDate, notes, setNote } = useVisitedRegions(countryId);

  // Check for share URL on mount
  useEffect(() => {
    const data = parseShareHash();
    if (data) {
      setShareData(data);
      const firstKey = Object.keys(data).find((k) => countries[k]);
      if (firstKey) setCountryId(firstKey);
    }
  }, []);

  const isShareMode = !!shareData;
  const sharedVisited = isShareMode && shareData[countryId]
    ? new Set(shareData[countryId])
    : null;

  const displayVisited = isShareMode ? (sharedVisited || new Set()) : visited;
  const handleToggle = isShareMode ? () => {} : toggle;

  const exitShareMode = () => {
    setShareData(null);
    window.location.hash = '';
  };

  return (
    <div className="app">
      {isShareMode && (
        <div className="share-banner">
          Viewing shared progress &mdash;
          <button className="share-banner-btn" onClick={exitShareMode}>Exit</button>
        </div>
      )}
      <Sidebar
        country={country}
        visited={displayVisited}
        onToggle={handleToggle}
        onReset={isShareMode ? () => {} : reset}
        onCountryChange={setCountryId}
        readOnly={isShareMode}
        dates={isShareMode ? {} : dates}
        onSetDate={isShareMode ? () => {} : setDate}
        notes={isShareMode ? {} : notes}
        onSetNote={isShareMode ? () => {} : setNote}
        customColor={colors[countryId] || ''}
        onSetColor={(c) => setColor(countryId, c)}
      />
      <main className="map-container">
        <RegionMap country={country} visited={displayVisited} onToggle={handleToggle} />
        {!isShareMode && <ExportButton country={country} />}
      </main>
    </div>
  );
}
