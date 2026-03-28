import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const PARTICLE_COUNT = 80;
const COLORS = ['#F1C40F', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6', '#E67E22', '#1ABC9C'];
const DURATION = 2500;

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

export default function Confetti({ onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
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
  }, [onDone]);

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
