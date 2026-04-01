import { useEffect, useState } from 'react';

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
function IconFallback({ alt, className, fallback, size }) {
  if (!fallback) return null;

  const trimmedAlt = alt.trim();

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.75,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      {...(trimmedAlt ? { 'aria-label': trimmedAlt, role: 'img' } : { 'aria-hidden': 'true' })}
    >
      {fallback}
    </span>
  );
}

export default function Icon({ name, size = 24, className = '', fallback, alt = '' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [name]);

  if (!name || failed) {
    return <IconFallback alt={alt} className={className} fallback={fallback} size={size} />;
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
