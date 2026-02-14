import { useState } from 'react';
import RegionMap from './components/SwissMap';
import Sidebar from './components/Sidebar';
import useVisitedRegions from './hooks/useVisitedCantons';
import countries from './data/countries';

export default function App() {
  const [countryId, setCountryId] = useState('ch');
  const country = countries[countryId];
  const { visited, toggle, reset } = useVisitedRegions(countryId);

  return (
    <div className="app">
      <Sidebar
        country={country}
        visited={visited}
        onToggle={toggle}
        onReset={reset}
        onCountryChange={setCountryId}
      />
      <main className="map-container">
        <RegionMap country={country} visited={visited} onToggle={toggle} />
      </main>
    </div>
  );
}
