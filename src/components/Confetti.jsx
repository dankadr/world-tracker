import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const PARTICLE_COUNT = 80;
const COLORS = ['#F1C40F', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6', '#E67E22', '#1ABC9C'];
const DURATION = 2500;
const LS_KEY = 'swiss-tracker-confetti-milestones';

function createParticle(x, y) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 12,
    vy: Math.random() * -14 - 4,
    size: Math.random() * 6 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    gravity: 0.3,
    opacity: 1,
  };
}

/**
 * Returns the localStorage key used to track shown milestones.
 * Scoped per-user when userId is provided, otherwise global.
 */
function getMilestoneKey(userId) {
  return userId ? `swiss-tracker-u${userId}-${LS_KEY}` : LS_KEY;
}

/**
 * Checks whether a given milestone has already been shown.
 * milestoneId format: "{trackerId}-{pct}" e.g. "ch-25", "us-50"
 */
export function isMilestoneShown(trackerId, milestone, userId) {
  const key = getMilestoneKey(userId);
  try {
    const stored = localStorage.getItem(key);
    const shown = new Set(stored ? JSON.parse(stored) : []);
    return shown.has(`${trackerId}-${milestone}`);
  } catch {
    return false;
  }
}

/**
 * Persists a milestone as shown so it won't fire confetti again.
 */
export function markMilestoneShown(trackerId, milestone, userId) {
  const key = getMilestoneKey(userId);
  try {
    const stored = localStorage.getItem(key);
    const shown = new Set(stored ? JSON.parse(stored) : []);
    shown.add(`${trackerId}-${milestone}`);
    localStorage.setItem(key, JSON.stringify([...shown]));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Confetti burst animation component.
 *
 * Props:
 *   onDone     — callback fired when the animation completes
 *   trackerId  — tracker identifier (e.g. "ch", "us") used for milestone deduplication
 *   milestone  — numeric milestone value (e.g. 25, 50, 75, 100) used for deduplication
 *   userId     — optional user ID to scope the deduplication key
 *
 * When trackerId + milestone are provided the component checks localStorage on
 * mount and skips rendering entirely if the milestone has already been shown,
 * calling onDone immediately instead.  It also persists the milestone before the
 * animation starts so that toggling a region off and back on never re-triggers
 * confetti for the same milestone.
 */
export default function Confetti({ onDone, trackerId, milestone, userId }) {
  const canvasRef = useRef(null);

  // Deduplication guard: if this milestone was already shown, skip the animation.
  const shouldSkip =
    trackerId != null &&
    milestone != null &&
    isMilestoneShown(trackerId, milestone, userId);

  useEffect(() => {
    if (shouldSkip) {
      onDone?.();
      return;
    }

    // Mark the milestone as shown before the animation starts so that a rapid
    // toggle-off / toggle-on cannot sneak a second render through.
    if (trackerId != null && milestone != null) {
      markMilestoneShown(trackerId, milestone, userId);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cx = canvas.width / 2;
    const cy = canvas.height * 0.4;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(cx, cy));
    const startTime = Date.now();
    let raf;

    function frame() {
      const elapsed = Date.now() - startTime;
      if (elapsed > DURATION) {
        onDone?.();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fadeStart = DURATION * 0.6;
      const globalAlpha = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / (DURATION - fadeStart) : 1;

      for (const p of particles) {
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.vx *= 0.99;

        ctx.save();
        ctx.globalAlpha = globalAlpha * p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [onDone, shouldSkip, trackerId, milestone, userId]);

  if (shouldSkip) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />,
    document.body
  );
}
