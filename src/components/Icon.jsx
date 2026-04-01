import { useState } from 'react';

/**
 * Icon component — loads SVGs from /icons/{name}.svg.
 * Falls back to the `fallback` prop (emoji/text) on error, or renders nothing.
 *
 * @param {string}  name      — icon path relative to /icons/, e.g. "ui/friends"
 * @param {number}  size      — width/height in px (default 24)
 * @param {string}  className — extra CSS classes
 * @param {string}  fallback  — emoji or text to render when the SVG fails to load
 * @param {string}  alt       — alt text for the image (default '')
 */
export default function Icon({ name, size = 24, className = '', fallback, alt = '' }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    if (fallback) {
      return (
        <span
          className={className}
          style={{ fontSize: size * 0.75, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
          aria-label={alt || name}
          role="img"
        >
          {fallback}
        </span>
      );
    }
    return null;
  }

  return (
    <img
      src={`/icons/${name}.svg`}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0 }}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}
