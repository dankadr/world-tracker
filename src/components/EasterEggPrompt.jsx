import { useState, useRef, useEffect } from 'react';
import { toggleGreaterIsrael } from '../utils/easterEggs';
import './EasterEggPrompt.css';

export default function EasterEggPrompt({ isOpen, onClose }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the input is rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 0);
      setInput('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (input.toLowerCase() === 'israel') {
      toggleGreaterIsrael();
      window.dispatchEvent(new CustomEvent('easter-egg-toggle', { detail: 'greater-israel' }));
      setInput('');
      setError('');
      onClose();
    } else {
      setError('Incorrect answer');
      setInput('');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInput('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="easter-egg-backdrop" onClick={onClose}>
      <div className="easter-egg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="easter-egg-content">
          <h2>🔒</h2>
          <p>Enter the access phrase to continue.</p>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type the phrase..."
            className="easter-egg-input"
            maxLength={50}
          />
          {error && <div className="easter-egg-error">{error}</div>}
          <div className="easter-egg-buttons">
            <button onClick={handleSubmit} className="easter-egg-submit">
              Submit
            </button>
            <button onClick={onClose} className="easter-egg-cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
