import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('public/icons', { recursive: true });

const src = 'public/logo.png';

// Standard icons — crop to square and resize
await sharp(src).resize(192, 192, { fit: 'cover' }).toFile('public/icons/icon-192.png');
await sharp(src).resize(512, 512, { fit: 'cover' }).toFile('public/icons/icon-512.png');

// Maskable icon — add 10% safe-area padding (Android adaptive icons)
// The image occupies the inner 80% of the canvas; the outer 10% on each side is the safe zone.
const maskableSize = 512;
const innerSize = Math.round(maskableSize * 0.8);
const padding = Math.round(maskableSize * 0.1);
const inner = await sharp(src)
  .resize(innerSize, innerSize, { fit: 'cover' })
  .toBuffer();
await sharp({
  create: { width: maskableSize, height: maskableSize, channels: 4, background: { r: 245, g: 230, b: 208, alpha: 1 } },
})
  .composite([{ input: inner, top: padding, left: padding }])
  .png()
  .toFile('public/icons/icon-512-maskable.png');

console.log('Icons generated in public/icons/');
