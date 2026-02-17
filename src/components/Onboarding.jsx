import { useState } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'swiss-tracker-onboarding-done';

const steps = [
  {
    title: 'Pick a Country',
    desc: 'Use the tabs to switch between countries and regions you want to track.',
    icon: '🌍',
  },
  {
    title: 'Mark Your Visits',
    desc: 'Click regions on the map or check them in the sidebar list. Add dates and notes too!',
    icon: '✅',
  },
  {
    title: 'Earn Achievements',
    desc: 'Unlock badges, customize your avatar, and track your travel progress across the world.',
    icon: '🏆',
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  if (dismissed) return null;

  function finish() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }

  function next() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  }

  const s = steps[step];

  return createPortal(
    <div className="onboarding-overlay" onClick={finish}>
      <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
        <span className="onboarding-icon">{s.icon}</span>
        <h2 className="onboarding-title">{s.title}</h2>
        <p className="onboarding-desc">{s.desc}</p>
        <div className="onboarding-dots">
          {steps.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-skip" onClick={finish}>Skip</button>
          <button className="onboarding-next" onClick={next}>
            {step < steps.length - 1 ? 'Next' : "Let's Go!"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
