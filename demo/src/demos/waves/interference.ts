/**
 * Two-source wave interference on a canvas — the gallery's live DemoMount
 * example. Self-contained: no dependencies, the ink color read from the
 * page's design tokens so the demo follows the theme.
 *
 * The animation runs only while the canvas is on screen and the tab is
 * visible; under `prefers-reduced-motion` it draws one still frame.
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

  // the distance field is static; only the phase moves
  const dist = sources.map((s) => {
    const d = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = Math.hypot(x - s.x, y - s.y);
    return d;
  });

  // ink color from the live tokens (re-read when the theme flips)
  let ink: [number, number, number] = [0, 0, 0];
  const readInk = (): void => {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--color-ink');
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim().replace('#', ''));
    const n = m ? parseInt(m[1]!, 16) : 0;
    ink = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };
  readInk();

  let t = 0;
  const frame = (): void => {
    const [r, g, b] = ink;
    for (let i = 0; i < w * h; i++) {
      let amp = 0;
      for (const d of dist) amp += Math.sin(k * d[i]! - t);
      // amp ∈ [-2, 2] → opacity of the ink over the (transparent) paper
      const o = i * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = Math.round(((amp + 2) / 4) * 130);
    }
    ctx.putImageData(img, 0, 0);
    t += 0.35;
  };

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0;
  let visible = false;
  const tick = (): void => {
    frame();
    raf = requestAnimationFrame(tick);
  };
  const update = (): void => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (still.matches || document.hidden) {
      frame();
      return;
    }
    if (visible) raf = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (recs) => {
      visible = recs.some((r) => r.isIntersecting);
      update();
    },
    { threshold: 0.05 },
  );
  io.observe(canvas);
  const onTheme = (): void => {
    readInk();
    frame();
  };
  window.addEventListener('themechange', onTheme);
  document.addEventListener('visibilitychange', update);
  still.addEventListener('change', update);
  frame();

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener('themechange', onTheme);
    document.removeEventListener('visibilitychange', update);
    still.removeEventListener('change', update);
  };
}
