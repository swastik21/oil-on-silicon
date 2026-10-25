import { clamp } from './rand.js';

// A magnifying glass that follows the pointer over a painting. The canvases
// are painted at ~1.4x screen resolution, so there is real detail to show.
// TODO: there's no way to use it from the keyboard yet

const SIZE = 196;
const el = document.getElementById('loupe');
const lens = el.querySelector('canvas');
const ctx = lens.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
lens.width = lens.height = Math.round(SIZE * dpr);

let current = null;
let frame = 0;
let fingerDown = false;
let hideTimer = 0;

function draw() {
  frame = 0;
  if (!current) return;
  const { canvas, x, y, touch } = current;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;

  // about 3.6x what's on screen, but never past the canvas's own pixels by much
  const zoom = clamp((rect.width / canvas.width) * 3.6, 0.8, 1.8);
  const side = SIZE / zoom;
  const px = ((x - rect.left) / rect.width) * canvas.width;
  const py = ((y - rect.top) / rect.height) * canvas.height;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, lens.width, lens.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, px - side / 2, py - side / 2, side, side, 0, 0, lens.width, lens.height);

  // on touch, hold it above the finger
  let left = x - SIZE / 2;
  let top = touch ? y - SIZE - 36 : y - SIZE / 2;
  left = clamp(left, 6, window.innerWidth - SIZE - 6);
  if (top < 6) top = touch ? y + 36 : 6;
  el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  el.hidden = false;
}

function moveTo(canvas, e, touch) {
  clearTimeout(hideTimer);
  current = { canvas, x: e.clientX, y: e.clientY, touch };
  if (!frame) frame = requestAnimationFrame(draw);
}

function hide() {
  current = null;
  el.hidden = true;
}

export function attachLoupe(canvas) {
  const box = canvas.parentElement;
  box.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') moveTo(canvas, e, false);
    else if (fingerDown) moveTo(canvas, e, true);
  });
  box.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') hide();
  });
  box.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    fingerDown = true;
    moveTo(canvas, e, true);
  });
  const lift = (e) => {
    if (e.pointerType !== 'touch') return;
    fingerDown = false;
    hideTimer = setTimeout(hide, 1400);
  };
  box.addEventListener('pointerup', lift);
  box.addEventListener('pointercancel', lift);
}

// redraw after the painting under the loupe changes
export function refreshLoupe() {
  if (current && !frame) frame = requestAnimationFrame(draw);
}

window.addEventListener('scroll', () => {
  if (current && !current.touch) hide();
}, { passive: true });
