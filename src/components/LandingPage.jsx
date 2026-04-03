import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const STATS = [
  { number: '238', label: 'countries' },
  { number: '26', label: 'Swiss cantons' },
  { number: '52', label: 'US states' },
  { number: '63', label: "nat'l parks" },
  { number: '270', label: 'UNESCO sites' },
];

const FEATURES = [
  {
    icon: '🗺️',
    title: 'Interactive Map',
    desc: 'Tap any country or region to mark it visited. Zoom into cantons, states & parks.',
  },
  {
    icon: '👥',
    title: 'Friends & Challenges',
    desc: 'Compare your map with friends. Create challenges and see who travels furthest.',
  },
  {
    icon: '🏆',
    title: 'Achievements',
    desc: 'Earn badges as you explore. Unlock milestones from first trip to globe-trotter.',
  },
  {
    icon: '📋',
    title: 'Bucket List',
    desc: 'Save places you want to visit. Turn your wishlist into a travel plan.',
  },
  {
    icon: '📴',
    title: 'Works Offline',
    desc: "Install as an app on your phone. Works without internet, syncs when you're back.",
  },
  {
    icon: '🔒',
    title: 'Private & Secure',
    desc: 'Your data is encrypted. No ads, no tracking, no nonsense. Just your travels.',
  },
];

export default function LandingPage({ onGuest }) {
  const { login, loading } = useAuth();
  const googleBtnRef = useRef(null);
  const [gsiReady, setGsiReady] = useState(false);
  const [error, setError] = useState(null);

  // Wait for Google Identity Services SDK to load
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let timerId;
    function checkGsi() {
      if (window.google?.accounts?.id) {
        setGsiReady(true);
      } else {
        timerId = setTimeout(checkGsi, 200);
      }
    }
    checkGsi();
    return () => clearTimeout(timerId);
  }, []);

  // Render the official Google Sign-In button in the hero
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !gsiReady || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setError(null);
        try {
          await login(response.credential);
        } catch (err) {
          setError(err.message);
        }
      },
    });
    try {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 260,
        text: 'signin_with',
      });
    } catch {
      // GIS can throw if the container moves in the DOM — safe to ignore
    }
  }, [gsiReady, login]);

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <div className="landing-nav-logo-icon">🌍</div>
          Right World Tracker
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <p className="landing-eyebrow">Free travel tracker app</p>
        <h1 className="landing-headline">
          Your travels,{' '}<br />beautifully mapped.
        </h1>
        <p className="landing-sub">
          The travel tracker app that builds your personal visited countries map —
          across countries, Swiss cantons, US states, national parks, and UNESCO sites.
          Track where you've been, plan where you're going, and share it with friends.
        </p>
        <div className="landing-stats">
          {STATS.map(({ number, label }) => (
            <div key={label} className="landing-stat">
              <div className="landing-stat-number">{number}</div>
              <div className="landing-stat-label">{label}</div>
            </div>
          ))}
        </div>
        <div className="landing-google-btn-container">
          {loading ? (
            <span style={{ fontSize: 13, color: '#4a6a8a' }}>Signing in…</span>
          ) : (
            <div ref={googleBtnRef} />
          )}
        </div>
        {error && <p style={{ color: 'red', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <button className="landing-guest-btn" onClick={onGuest}>
          Continue without account
        </button>
      </section>

      <div className="landing-divider" />

      {/* Features */}
      <section className="landing-features">
        <p className="landing-section-eyebrow">Everything in one place</p>
        <h2 className="landing-section-title">More than a places I've been app.</h2>
        <div className="landing-feature-grid">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="landing-feature-card">
              <div className="landing-feature-icon">{icon}</div>
              <div className="landing-feature-title">{title}</div>
              <p className="landing-feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-divider" />

      {/* Closing CTA */}
      <section className="landing-closing">
        <h2 className="landing-closing-title">Start building your visited countries map.</h2>
        <p className="landing-closing-sub">
          Free forever · No ads · Works offline · Sign in with Google
        </p>
        <button
          className="landing-cta-btn"
          disabled={loading}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          {loading ? 'Signing in…' : 'Sign in to get started →'}
        </button>
      </section>
    </div>
  );
}
