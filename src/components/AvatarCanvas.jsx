import { useRef, useEffect } from 'react';
import { avatarCategories, hairColorOptions } from '../config/avatarParts';

function drawLayer(ctx, part, scale, colorOverride) {
  if (!part || !part.rows) return;
  const palette = part.palette || {};
  for (let r = 0; r < part.rows.length; r++) {
    const row = part.rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      let color = palette[ch];
      if (colorOverride && color) {
        color = colorOverride;
      }
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(c * scale, r * scale, scale, scale);
    }
  }
}

export default function AvatarCanvas({ config, size = 64 }) {
  const canvasRef = useRef(null);
  const scale = size / 16;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    const bgParts = avatarCategories.background.parts;
    const bodyParts = avatarCategories.body.parts;
    const hairParts = avatarCategories.hair.parts;
    const eyeParts = avatarCategories.eyes.parts;
    const shirtParts = avatarCategories.shirt.parts;
    const hatParts = avatarCategories.hat.parts;
    const accParts = avatarCategories.accessory.parts;

    const bg = bgParts[config.background] || bgParts[0];
    const body = bodyParts[config.body] || bodyParts[0];
    const hair = hairParts[config.hair] || hairParts[0];
    const eyeStyle = eyeParts[config.eyes] || eyeParts[0];
    const shirt = shirtParts[config.shirt] || shirtParts[0];
    const hat = hatParts[config.hat] || hatParts[0];
    const acc = accParts[config.accessory] || accParts[0];

    const hairColor = hairColorOptions[config.hairColor]?.color || hairColorOptions[0].color;

    drawLayer(ctx, bg, scale);
    drawLayer(ctx, body, scale);
    drawLayer(ctx, hair, scale, hairColor);
    drawLayer(ctx, eyeStyle, scale);
    drawLayer(ctx, shirt, scale);
    drawLayer(ctx, hat, scale);
    drawLayer(ctx, acc, scale);
  }, [config, size, scale]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="avatar-canvas"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
