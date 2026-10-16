import { PNG } from "pngjs";
import { SCOUT_LOGO_PNG_BASE64 } from "@/assets/scout-logo";

const LOGO_PNG_BUFFER = Buffer.from(SCOUT_LOGO_PNG_BASE64, "base64");

/**
 * Fraction of the QR side covered by the centered logo badge. The QR is
 * generated with error correction level "H" (≈30% recovery), so a centered
 * overlay of ~22% stays comfortably scannable.
 */
const BADGE_RATIO = 0.22;
/** White padding around the logo, relative to the badge size. */
const LOGO_INSET_RATIO = 0.09;
/** Corner radius of the badge, relative to the badge size. */
const RADIUS_RATIO = 0.16;

type Rgba = { r: number; g: number; b: number; a: number };

function readPixel(png: PNG, x: number, y: number): Rgba {
  const i = (y * png.width + x) * 4;
  return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2], a: png.data[i + 3] };
}

function writePixel(png: PNG, x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = a;
}

function blendPixel(png: PNG, x: number, y: number, r: number, g: number, b: number, alpha: number) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = Math.round(png.data[i] * (1 - alpha) + r * alpha);
  png.data[i + 1] = Math.round(png.data[i + 1] * (1 - alpha) + g * alpha);
  png.data[i + 2] = Math.round(png.data[i + 2] * (1 - alpha) + b * alpha);
  png.data[i + 3] = 255;
}

/** Average color of the four corners, so the badge blends with the logo background. */
function cornerColor(png: PNG): Rgba {
  const points: Array<[number, number]> = [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of points) {
    const p = readPixel(png, x, y);
    r += p.r;
    g += p.g;
    b += p.b;
  }
  return { r: Math.round(r / points.length), g: Math.round(g / points.length), b: Math.round(b / points.length), a: 255 };
}

/** Area-average sampling: maps a source rectangle to a single destination pixel. */
function sampleArea(png: PNG, x0: number, y0: number, x1: number, y1: number): Rgba {
  const sx0 = Math.max(0, Math.floor(x0));
  const sy0 = Math.max(0, Math.floor(y0));
  const sx1 = Math.min(png.width, Math.ceil(x1));
  const sy1 = Math.min(png.height, Math.ceil(y1));
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  for (let sy = sy0; sy < sy1; sy++) {
    for (let sx = sx0; sx < sx1; sx++) {
      const i = (sy * png.width + sx) * 4;
      r += png.data[i];
      g += png.data[i + 1];
      b += png.data[i + 2];
      a += png.data[i + 3];
      n++;
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: r / n, g: g / n, b: b / n, a: a / n };
}

function insideRoundedRect(x: number, y: number, w: number, h: number, radius: number): boolean {
  if (x >= radius && x < w - radius) return true;
  if (y >= radius && y < h - radius) return true;
  const cx = x < radius ? radius : w - 1 - radius;
  const cy = y < radius ? radius : h - 1 - radius;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Overlays the Grupo Scout 62 logo (on a rounded badge) at the center of an
 * already-rendered QR PNG. Returns a new PNG buffer. If the embedded logo
 * cannot be decoded, the original QR buffer is returned untouched.
 */
export function brandQrWithLogo(qrPng: Buffer): Buffer {
  let qr: PNG;
  let logo: PNG;
  try {
    qr = PNG.sync.read(qrPng);
    logo = PNG.sync.read(LOGO_PNG_BUFFER);
  } catch {
    return qrPng;
  }

  const badgeSize = Math.round(qr.width * BADGE_RATIO);
  const radius = Math.round(badgeSize * RADIUS_RATIO);
  const inset = Math.round(badgeSize * LOGO_INSET_RATIO);
  const logoSize = Math.max(1, badgeSize - inset * 2);
  const x0 = Math.round((qr.width - badgeSize) / 2);
  const y0 = Math.round((qr.height - badgeSize) / 2);
  const bg = cornerColor(logo);

  for (let y = 0; y < badgeSize; y++) {
    for (let x = 0; x < badgeSize; x++) {
      if (!insideRoundedRect(x, y, badgeSize, badgeSize, radius)) continue;
      writePixel(qr, x0 + x, y0 + y, bg.r, bg.g, bg.b, 255);
    }
  }

  const logoX0 = x0 + Math.round((badgeSize - logoSize) / 2);
  const logoY0 = y0 + Math.round((badgeSize - logoSize) / 2);
  for (let dy = 0; dy < logoSize; dy++) {
    for (let dx = 0; dx < logoSize; dx++) {
      const sx0 = (dx / logoSize) * logo.width;
      const sx1 = ((dx + 1) / logoSize) * logo.width;
      const sy0 = (dy / logoSize) * logo.height;
      const sy1 = ((dy + 1) / logoSize) * logo.height;
      const p = sampleArea(logo, sx0, sy0, sx1, sy1);
      if (p.a < 1) continue;
      blendPixel(qr, logoX0 + dx, logoY0 + dy, p.r, p.g, p.b, p.a / 255);
    }
  }

  return PNG.sync.write(qr);
}
