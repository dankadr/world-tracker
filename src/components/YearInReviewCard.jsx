import { useEffect, useState, useRef } from 'react';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function AnimatedCount({ target, duration = 1200, suffix = '' }) {
  const [value, setValue] = useState(0);
  const ref = useRef();

  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);

  return <span>{value.toLocaleString()}{suffix}</span>;
}

function MonthChart({ monthCounts }) {
  const max = Math.max(...monthCounts, 1);
  return (
    <div className="yir-month-chart">
      {monthCounts.map((count, i) => (
        <div key={i} className="yir-month-bar-wrap">
          <div
            className="yir-month-bar"
            style={{
              height: `${(count / max) * 100}%`,
              animationDelay: `${i * 80}ms`,
            }}
          />
          <span className="yir-month-label">{MONTH_LABELS[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function YearInReviewCard({ type, stats, visible }) {
  if (!visible) return null;

  switch (type) {
    case 'title':
      return (
        <div className="yir-card yir-card-title">
          <div className="yir-globe">🌍</div>
          <h1 className="yir-year-text">Your {stats.year}</h1>
          <h2 className="yir-subtitle">Year in Review</h2>
          <p className="yir-tagline">Let's see where you've been</p>
        </div>
      );

    case 'regions':
      return (
        <div className="yir-card yir-card-regions">
          <div className="yir-card-icon">📍</div>
          <div className="yir-big-number">
            <AnimatedCount target={stats.totalRegions} />
          </div>
          <p className="yir-card-label">new regions explored</p>
          <p className="yir-card-detail">
            across <strong>{stats.trackersUsed}</strong> tracker{stats.trackersUsed !== 1 ? 's' : ''}
          </p>
          {stats.trackerBreakdown.length > 0 && (
            <div className="yir-tracker-list">
              {stats.trackerBreakdown.map(t => (
                <div key={t.id} className="yir-tracker-row">
                  <span className="yir-tracker-flag">{t.flag}</span>
                  <span className="yir-tracker-name">{t.name}</span>
                  <span className="yir-tracker-count" style={{ color: t.color }}>
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'topTracker':
      if (!stats.topTracker) return null;
      return (
        <div className="yir-card yir-card-top-tracker">
          <div className="yir-card-icon">🏆</div>
          <p className="yir-card-label">Most active tracker</p>
          <div className="yir-top-tracker-flag">{stats.topTracker.flag}</div>
          <h2 className="yir-top-tracker-name">{stats.topTracker.name}</h2>
          <div className="yir-big-number">
            <AnimatedCount target={stats.topTracker.count} />
          </div>
          <p className="yir-card-detail">
            new {stats.topTracker.regionLabel.toLowerCase()}
          </p>
        </div>
      );

    case 'activity':
      return (
        <div className="yir-card yir-card-activity">
          <div className="yir-card-icon">📅</div>
          <div className="yir-big-number">
            <AnimatedCount target={stats.totalVisitDays} />
          </div>
          <p className="yir-card-label">unique days with visits</p>
          {stats.firstVisitDate && stats.lastVisitDate && (
            <p className="yir-card-detail">
              {stats.firstVisitDate} → {stats.lastVisitDate}
            </p>
          )}
          {stats.busiestMonth && (
            <p className="yir-card-highlight">
              {stats.busiestMonth} was your busiest month with {stats.busiestMonthCount} visit{stats.busiestMonthCount !== 1 ? 's' : ''}
            </p>
          )}
          <MonthChart monthCounts={stats.monthCounts} />
        </div>
      );

    case 'achievements':
      return (
        <div className="yir-card yir-card-achievements">
          <div className="yir-card-icon">🎖️</div>
          <div className="yir-big-number">
            <AnimatedCount target={stats.achievementsUnlocked} />
          </div>
          <p className="yir-card-label">achievements unlocked</p>
          <p className="yir-card-detail">(all time)</p>
        </div>
      );

    case 'comparison':
      return (
        <div className="yir-card yir-card-comparison">
          <div className="yir-card-icon">📊</div>
          {stats.comparedToPrevYear === 'first-year' ? (
            <>
              <h2 className="yir-comp-text">You started tracking!</h2>
              <p className="yir-card-detail">
                This was your first year with dated visits. Here's to many more!
              </p>
            </>
          ) : stats.comparedToPrevYear ? (
            <>
              <div className="yir-big-number yir-comp-number">
                {stats.comparedToPrevYear}
              </div>
              <p className="yir-card-label">
                {stats.comparedToPrevYear.startsWith('+') ? 'more' : 'fewer'} regions than {stats.year - 1}
              </p>
            </>
          ) : (
            <>
              <h2 className="yir-comp-text">{stats.totalRegions} regions</h2>
              <p className="yir-card-detail">
                explored in {stats.year}
              </p>
            </>
          )}
        </div>
      );

    case 'summary':
      return (
        <div className="yir-card yir-card-summary">
          <div className="yir-card-icon">✨</div>
          <h2 className="yir-summary-title">{stats.year} Recap</h2>
          <div className="yir-summary-grid">
            <div className="yir-summary-stat">
              <span className="yir-summary-num">{stats.totalRegions}</span>
              <span className="yir-summary-label">Regions</span>
            </div>
            <div className="yir-summary-stat">
              <span className="yir-summary-num">{stats.trackersUsed}</span>
              <span className="yir-summary-label">Trackers</span>
            </div>
            <div className="yir-summary-stat">
              <span className="yir-summary-num">{stats.totalVisitDays}</span>
              <span className="yir-summary-label">Days</span>
            </div>
            <div className="yir-summary-stat">
              <span className="yir-summary-num">{stats.achievementsUnlocked}</span>
              <span className="yir-summary-label">Achievements</span>
            </div>
          </div>
          {stats.topTracker && (
            <p className="yir-card-detail" style={{ marginTop: '16px' }}>
              Top tracker: {stats.topTracker.flag} {stats.topTracker.name}
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}
