import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstallPrompt from '../InstallPrompt';

const ORIGINAL_USER_AGENT = navigator.userAgent;
const ORIGINAL_VENDOR = navigator.vendor;
const ORIGINAL_MATCH_MEDIA = window.matchMedia;
const ORIGINAL_STANDALONE = navigator.standalone;

function setPlatform({ userAgent, vendor = '', standalone = false, standaloneDisplay = false }) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'vendor', {
    value: vendor,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'standalone', {
    value: standalone,
    configurable: true,
  });
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(display-mode: standalone)' ? standaloneDisplay : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function dispatchBeforeInstallPrompt(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt');
  event.preventDefault = vi.fn();
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: ORIGINAL_USER_AGENT,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'vendor', {
      value: ORIGINAL_VENDOR,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: ORIGINAL_STANDALONE,
      configurable: true,
    });
    window.matchMedia = ORIGINAL_MATCH_MEDIA;
  });

  it('shows the native install CTA for Android browsers that fire beforeinstallprompt', async () => {
    const user = userEvent.setup();
    setPlatform({
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/123.0 Mobile Safari/537.36',
      vendor: 'Google Inc.',
    });

    render(<InstallPrompt />);

    let installEvent;
    await act(async () => {
      installEvent = dispatchBeforeInstallPrompt();
    });

    await user.click(await screen.findByTestId('install-prompt-install'));

    expect(installEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(installEvent.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument());
  });

  it('shows manual Add to Home Screen instructions on iPhone Safari', async () => {
    setPlatform({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
      vendor: 'Apple Computer, Inc.',
    });

    render(<InstallPrompt />);

    expect(await screen.findByTestId('install-prompt-ios-steps')).toBeInTheDocument();
    expect(screen.getByText(/Tap the Share button in Safari/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose Add to Home Screen/i)).toBeInTheDocument();
  });

  it('stays hidden when the app is already installed', () => {
    setPlatform({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
      vendor: 'Apple Computer, Inc.',
      standaloneDisplay: true,
    });

    render(<InstallPrompt />);

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
  });

  it('stays hidden while a dismissal cooldown is active', () => {
    localStorage.setItem('pwa-install-state', JSON.stringify({
      dismissedUntil: Date.now() + 60_000,
      lastDismissReason: 'dismissed',
    }));
    setPlatform({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
      vendor: 'Apple Computer, Inc.',
    });

    render(<InstallPrompt />);

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
  });

  it('persists a cooldown when the user dismisses the prompt', async () => {
    const user = userEvent.setup();
    setPlatform({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
      vendor: 'Apple Computer, Inc.',
    });

    render(<InstallPrompt />);

    await user.click(await screen.findByTestId('install-prompt-dismiss'));

    const stored = JSON.parse(localStorage.getItem('pwa-install-state'));
    expect(stored.lastDismissReason).toBe('dismissed');
    expect(stored.dismissedUntil).toBeGreaterThan(Date.now());
    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
  });
});
