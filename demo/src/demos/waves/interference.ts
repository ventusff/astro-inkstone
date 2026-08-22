/**
 * Two-source wave interference on a canvas — the gallery's live DemoMount
 * example. Self-contained: no dependencies, colors read from the page's
 * design tokens so the demo follows the theme.
 */
import type { DemoCleanup, DemoCtx } from '../../lib/demo-loader';

export default function mount({ canvases }: DemoCtx): DemoCleanup {
  const canvas = canvases[0];
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width: w, height: h } = canvas;
  const img = ctx.createImageData(w, h);
  const px = img.data;

  // wave sources sit at 1/3 and 2/3 of the width
  const sources = [
    { x: w / 3, y: h / 2 },
    { x: (2 * w) / 3, y: h / 2 },
  ];
  const wavelength = 26;
  const k = (2 * Math.PI) / wavelength;

  // ink color from the live tokens, so dark mode renders in moon-white
  const readInk = (): [number, number, number] => {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--color-ink');
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim().replace('#', ''));
    const n = m ? parseInt(m[1]!, 16) : 0x25313a;
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };

  let raf = 0;
  let t = 0;
  const draw = (): void => {
    const [r, g, b] = readInk();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let amp = 0;
        for (const s of sources) {
          const d = Math.hypot(x - s.x, y - s.y);
          amp += Math.sin(k * d - t);
        }
        // amp ∈ [-2, 2] → opacity of the ink over the (transparent) paper
        const a = Math.round(((amp + 2) / 4) * 130);
        const i = (y * w + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    t += 0.35;
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return () => cancelAnimationFrame(raf);
}
