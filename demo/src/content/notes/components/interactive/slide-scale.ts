/**
 * How a slide scales: one 960 × 540 canvas, shown at the width the slider
 * asks for, or at the stage's own width when that is narrower. A page demo
 * of the engine's own loader (DemoMount `module`): it sits beside the note
 * that shows it and reads its words from slide-scale.json, in the page's
 * language.
 */
import { inLocale } from 'astro-inkstone/lib/figure-file';
import type { PageDemoCleanup, PageDemoContext } from 'astro-inkstone/lib/page-demos';

import figure from './slide-scale.json';

const CANVAS_W = 960;
const CANVAS_H = 540;

export default function mount({ stage, locale }: PageDemoContext): PageDemoCleanup {
  const words = inLocale<Record<keyof typeof figure, string>>(figure, locale);

  const label = document.createElement('label');
  label.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-family:var(--font-ui);font-size:13px;color:var(--color-ink-soft)';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '240';
  slider.max = String(CANVAS_W);
  slider.value = '480';
  const readout = document.createElement('output');
  readout.style.fontVariantNumeric = 'tabular-nums';
  label.append(words.width, slider, readout);

  const frame = document.createElement('div');
  frame.style.cssText = 'margin-top:12px;overflow:hidden;border:1px solid var(--color-line);background:var(--color-bg-card)';
  const canvas = document.createElement('div');
  canvas.style.cssText = `width:${CANVAS_W}px;height:${CANVAS_H}px;padding:40px 56px;box-sizing:border-box;transform-origin:0 0;font-family:var(--font-display);font-size:34px;color:var(--color-ink)`;
  canvas.textContent = words.slide;
  frame.append(canvas);
  stage.append(label, frame);

  const draw = () => {
    const room = stage.clientWidth - Number.parseFloat(getComputedStyle(stage).paddingLeft) * 2 - 2;
    const width = Math.max(0, Math.min(Number(slider.value), room));
    const k = width / CANVAS_W;
    frame.style.width = `${width}px`;
    frame.style.height = `${CANVAS_H * k}px`;
    canvas.style.transform = `scale(${k})`;
    readout.value = `${Math.round(width)} px · ${words.scale} ${k.toFixed(2)}`;
  };
  const resized = new ResizeObserver(draw);
  resized.observe(stage);
  slider.addEventListener('input', draw);
  draw();
  return () => {
    resized.disconnect();
    slider.removeEventListener('input', draw);
    stage.replaceChildren();
  };
}
