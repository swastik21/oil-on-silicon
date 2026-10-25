import { highlight } from './syntax.js';
import { clamp } from './rand.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// localStorage throws in some private windows
export const storage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // not saved, nothing else to do
    }
  },
};

// fill a <pre> with highlighted, numbered lines; returns the line elements
export function showCode(pre, code) {
  pre.innerHTML = '<code>' +
    highlight(code).map((html, i) => `<span class="ln" data-n="${i + 1}">${html || ' '}</span>`).join('') +
    '</code>';
  return pre.querySelectorAll('.ln');
}

export function measure(code) {
  const lines = (code || '').split('\n');
  let cols = 0;
  for (const l of lines) {
    let c = 0;
    for (const ch of l) c += ch === '\t' ? 4 - (c % 4) : 1;
    cols = Math.max(cols, c);
  }
  const n = code ? lines.length : 0;
  return { lines: n, cols, text: `${n} ${n === 1 ? 'line' : 'lines'} × ${cols} ${cols === 1 ? 'col' : 'cols'}` };
}

// paint at a bit more than screen resolution, so the loupe has detail to show
export function sizeCanvas(canvas, aspect, maxHeight) {
  const box = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const h = Math.round(clamp(box.height > 0 ? box.height * dpr * 1.4 : 1000, 760, maxHeight));
  canvas.height = h;
  canvas.width = Math.round(h * aspect);
}

// the letters inside the strokes need the mono font; don't wait forever for it
export const fontsReady = Promise.race([
  Promise.all([document.fonts.load('16px "JetBrains Mono"'), document.fonts.load('40px "Herr Von Muellerhoff"')]),
  new Promise((resolve) => setTimeout(resolve, 2500)),
]).catch(() => {});
