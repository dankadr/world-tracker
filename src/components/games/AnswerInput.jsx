import { useState, useCallback } from 'react';
import { fuzzyMatches } from '../../utils/gameAnswers';
import './games.css';

export default function AnswerInput({ candidates, nameKey = 'name', onSubmit, onSkip, disabled, dropUp = false }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = value.length > 0 ? fuzzyMatches(value, candidates, nameKey) : [];

  const handleSubmit = useCallback((val) => {
    if (!val.trim() || disabled) return;
    onSubmit(val);
    setValue('');
    setOpen(false);
  }, [onSubmit, disabled]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit(value);
    if (e.key === 'Tab') { e.preventDefault(); onSkip?.(); setValue(''); setOpen(false); }
  };

  return (
    <div className="answer-input-wrapper">
      <input
        className="answer-input"
        type="text"
        value={value}
        onChange={e => { setValue(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type your answer..."
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <div className={`answer-autocomplete${dropUp ? ' answer-autocomplete--up' : ''}`}>
          {suggestions.map(s => (
            <button
              key={s.id ?? s[nameKey]}
              className="answer-autocomplete-item"
              onMouseDown={() => handleSubmit(s[nameKey])}
            >
              {s.flag && <span style={{ marginRight: 8 }}>{s.flag}</span>}
              {s[nameKey]}
            </button>
          ))}
        </div>
      )}
      <div className="game-actions" style={{ marginTop: 8 }}>
        <button className="game-btn game-btn-primary" onClick={() => handleSubmit(value)} disabled={disabled}>
          Submit
        </button>
        <button className="game-btn game-btn-secondary" onClick={onSkip} disabled={disabled}>
          Skip
        </button>
      </div>
    </div>
  );
}
