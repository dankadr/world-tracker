import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { computeYearStats } from '../utils/yearStats';
import YearInReviewCard from './YearInReviewCard';
import ShareCard from './ShareCard';
import './YearInReview.css';

const CARD_TYPES = ['title', 'regions', 'topTracker', 'activity', 'achievements', 'comparison', 'summary'];

export default function YearInReview({ year, onClose }) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(null); // 'left' | 'right' | null
  const touchStartRef = useRef(null);
  const containerRef = useRef(null);

  const stats = useMemo(() => computeYearStats(userId, year), [userId, year]);

  // Filter out cards that have no data
  const cards = useMemo(() => {
    return CARD_TYPES.filter(type => {
      if (type === 'topTracker' && !stats.topTracker) return false;
      if (type === 'regions' && stats.totalRegions === 0) return false;
      if (type === 'activity' && stats.totalVisitDays === 0) return false;
      return true;
    });
  }, [stats]);

  const goTo = useCallback((idx, dir) => {
    if (idx < 0 || idx >= cards.length) return;
    setDirection(dir);
    setTimeout(() => {
      setCurrentIndex(idx);
      setDirection(null);
    }, 250);
  }, [cards.length]);

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1) goTo(currentIndex + 1, 'left');
  }, [currentIndex, cards.length, goTo]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1, 'right');
  }, [currentIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  // Touch swipe
  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  // Share flow state
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [exportFormat, setExportFormat] = useState(null); // null | 'portrait' | 'square'
  const [exportTheme, setExportTheme] = useState('dark'); // 'dark' | 'light'
  const [exporting, setExporting] = useState(false);
  const shareCardRef = useRef(null);

  // Capture share card after it mounts — useEffect fires after DOM + ref are ready
  useEffect(() => {
    if (!exportFormat || !shareCardRef.current) return;

    let cancelled = false;
    setExporting(true);

    (async () => {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(shareCardRef.current, {
          backgroundColor: null,
          scale: 2,
        });
        if (!cancelled) {
          const link = document.createElement('a');
          link.download = `year-in-review-${year}-${exportFormat}-${exportTheme}.png`;
          link.href = canvas.toDataURL();
          link.click();
        }
      } catch (err) {
        console.error('Failed to export share card:', err);
      } finally {
        if (!cancelled) {
          setExporting(false);
          setExportFormat(null);
          setShowFormatPicker(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [exportFormat, year]);

  if (!stats.hasData) {
    return createPortal(
      <div className="yir-overlay" onClick={onClose}>
        <div className="yir-container yir-empty" onClick={e => e.stopPropagation()}>
          <button className="yir-close" onClick={onClose}>&times;</button>
          <div className="yir-card">
            <div className="yir-card-icon">🗺️</div>
            <h2>No dated visits in {year}</h2>
            <p className="yir-card-detail">
              Add dates to your visits to generate a Year in Review!
            </p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const isLastCard = currentIndex === cards.length - 1;

  return (
    <>
      {createPortal(
        <div className="yir-overlay" onClick={onClose}>
          <div
            className="yir-container"
            ref={containerRef}
            onClick={e => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button className="yir-close" onClick={onClose}>&times;</button>

            {/* Progress dots */}
            <div className="yir-dots">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className={`yir-dot ${i === currentIndex ? 'yir-dot-active' : ''} ${i < currentIndex ? 'yir-dot-done' : ''}`}
                  onClick={() => goTo(i, i > currentIndex ? 'left' : 'right')}
                />
              ))}
            </div>

            {/* Card */}
            <div className={`yir-card-wrapper ${direction ? `yir-slide-${direction}` : 'yir-slide-in'}`}>
              <YearInReviewCard type={cards[currentIndex]} stats={stats} visible={true} />
            </div>

            {/* Navigation */}
            <div className="yir-nav">
              <button className="yir-nav-btn" onClick={goPrev} disabled={currentIndex === 0} aria-label="Previous">
                ←
              </button>
              <span className="yir-nav-counter">{currentIndex + 1} / {cards.length}</span>
              {isLastCard ? (
                <button
                  className="yir-nav-btn yir-nav-share"
                  onClick={() => setShowFormatPicker(p => !p)}
                  disabled={exporting}
                  aria-label="Share"
                >
                  {exporting ? 'Saving…' : 'Share'}
                </button>
              ) : (
                <button className="yir-nav-btn" onClick={goNext} disabled={currentIndex === cards.length - 1} aria-label="Next">
                  →
                </button>
              )}
            </div>

            {/* Format + theme picker — appears below nav on last card */}
            {isLastCard && showFormatPicker && (
              <div className="yir-format-picker">
                <div className="yir-picker-row">
                  <button className={`yir-format-btn${exportFormat === 'portrait' ? ' active' : ''}`} onClick={() => setExportFormat('portrait')} disabled={exporting}>
                    {exporting && exportFormat === 'portrait' ? 'Saving…' : '📱 Portrait'}
                  </button>
                  <button className={`yir-format-btn${exportFormat === 'square' ? ' active' : ''}`} onClick={() => setExportFormat('square')} disabled={exporting}>
                    {exporting && exportFormat === 'square' ? 'Saving…' : '⬜ Square'}
                  </button>
                </div>
                <div className="yir-picker-row">
                  <button className={`yir-format-btn yir-theme-btn${exportTheme === 'dark' ? ' active' : ''}`} onClick={() => setExportTheme('dark')} disabled={exporting}>
                    🌑 Dark
                  </button>
                  <button className={`yir-format-btn yir-theme-btn${exportTheme === 'light' ? ' active' : ''}`} onClick={() => setExportTheme('light')} disabled={exporting}>
                    ☀️ Light
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Off-screen ShareCard — separate portal so it's not inside the overlay stacking context */}
      {exportFormat && createPortal(
        <ShareCard ref={shareCardRef} variant="yearly" format={exportFormat} theme={exportTheme} stats={stats} />,
        document.body
      )}
    </>
  );
}
