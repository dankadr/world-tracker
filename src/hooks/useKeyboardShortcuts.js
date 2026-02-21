import { useEffect } from 'react';
import { countryList } from '../data/countries';

export default function useKeyboardShortcuts({
  toggleTheme,
  countryId,
  setCountryId,
  searchRef,
  closeModals,
  onOpenEasterEggPrompt,
}) {
  useEffect(() => {
    function handleKey(e) {
      const tag = e.target.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

      if (e.key === 'Escape') {
        closeModals?.();
        if (document.activeElement) document.activeElement.blur();
        return;
      }

      if (isTyping) return;

      // Easter egg: Ctrl+Shift+I for Greater Israel prompt
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        onOpenEasterEggPrompt?.();
        return;
      }

      if (e.key === '/' || e.key === 'f') {
        e.preventDefault();
        searchRef?.current?.focus();
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleTheme?.();
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = countryList.findIndex((c) => c.id === countryId);
        if (idx === -1) return;
        const next = e.key === 'ArrowRight'
          ? (idx + 1) % countryList.length
          : (idx - 1 + countryList.length) % countryList.length;
        setCountryId?.(countryList[next].id);
        return;
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [toggleTheme, countryId, setCountryId, searchRef, closeModals, onOpenEasterEggPrompt]);
}

