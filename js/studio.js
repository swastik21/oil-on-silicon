import { Painting, PASSES, MODES, MAX_CHARS, pickMode } from './painter.js';
import { PALETTES, BRUSH, cssVars } from './palettes.js';
import { guessLanguage } from './syntax.js';
import { SELF_PORTRAIT, WORKS, SAMPLE } from './works.js';
import { $, escapeHtml, reducedMotion, storage, showCode, measure, sizeCanvas } from './ui.js';
import { attachLoupe, refreshLoupe } from './loupe.js';
import { linkTo, paintingInLink } from './share.js';

const SITE = 'swastik21.github.io/oil-on-silicon';

const MUSEUM = ['pigments', 'fresco', 'nocturne', 'midcentury', 'phosphor', 'press', 'arena'];
const EDITOR = ['monokai', 'dracula', 'solarized', 'nord', 'gruvbox'];
const LEGEND = ['pun', 'kw', 'fn', 'type', 'str', 'id', 'num', 'op', 'com'];
const speed = (seconds) => (reducedMotion ? 0 : seconds);

const textarea = $('#code');
const editor = $('#editor');
const editorLines = $('#editor-lines');
const canvas = $('#studio-canvas');
const statusLine = $('#studio-status');
const signatureInput = $('#signature');
const titleInput = $('#title');

const sample = { code: SAMPLE.code, palette: SAMPLE.palette, mode: SAMPLE.mode, modeChosen: true, title: SAMPLE.title, sign: '' };
const saved = storage.get('studio');
const state = saved && typeof saved.code === 'string' && PALETTES[saved.palette] && MODES[saved.mode]
  ? { ...sample, ...saved, title: String(saved.title ?? 'Untitled'), sign: String(saved.sign ?? '') }
  : { ...sample };

let saveTimer = 0;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => storage.set('studio', state), 400);
};

let lines = [];
let lit = null;
let sized = false;
let started = false;

const painting = new Painting(canvas, {
  keepUnsigned: true,
  onPass: (p) => {
    statusLine.textContent = PASSES[p] + '…';
  },
  onLine: (n) => {
    lit?.classList.remove('live');
    lit = lines[n] || null;
    lit?.classList.add('live');
  },
  onDone: (p) => {
    statusLine.textContent = p.plan.count
      ? `Finished in ${p.plan.count.toLocaleString()} strokes. Look closer to read them.`
      : 'A blank file is a blank canvas. Type or paste some code.';
    refreshLoupe();
    prepareShare();
  },
});
attachLoupe(canvas);

function paint(duration) {
  if (!sized) {
    sizeCanvas(canvas, 0.8, 1700);
    sized = true;
  }
  started = true;
  painting.set({ code: state.code, palette: state.palette, mode: state.mode, signature: state.sign.trim() });
  painting.start({ duration: speed(duration) });
}

// --- editor ---

function refresh() {
  editor.setAttribute('style', cssVars(state.palette));
  lines = showCode(editorLines, state.code);
  lit = null;
  editorLines.scrollTop = textarea.scrollTop;
  editorLines.scrollLeft = textarea.scrollLeft;

  const size = measure(state.code);
  const language = guessLanguage(state.code);
  $('#editor-info').textContent = state.code ? `${language}, ${size.text}` : 'Empty file';
  $('#studio-medium').textContent = state.code ? `${language} on silicon` : 'Nothing yet, on silicon';
  $('#studio-dims').textContent = size.text;
  canvas.setAttribute('aria-label',
    `A painting titled ${state.title || 'Untitled'}, made from the ${size.lines}-line program in the editor, in the ${PALETTES[state.palette].name} palette.`);
}

let repaintTimer = 0;
textarea.addEventListener('input', () => {
  state.code = textarea.value;
  if (!state.modeChosen) state.mode = pickMode(state.code);
  refresh();
  refreshChoices();
  save();
  clearTimeout(repaintTimer);
  repaintTimer = setTimeout(() => paint(1.4), 650);
});

textarea.addEventListener('scroll', () => {
  editorLines.scrollTop = textarea.scrollTop;
  editorLines.scrollLeft = textarea.scrollLeft;
});

// --- palette and composition ---

function radioGroup(container, keys, render, pick) {
  container.innerHTML = keys.map(render).join('');
  const buttons = [...container.querySelectorAll('[role="radio"]')];
  container.addEventListener('click', (e) => {
    const button = e.target.closest('[role="radio"]');
    if (button) pick(button.dataset.key);
  });
  container.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = buttons[(i + step + buttons.length) % buttons.length];
    next.focus();
    pick(next.dataset.key);
  });
  return buttons;
}

function select(buttons, key) {
  buttons.forEach((b) => {
    const on = b.dataset.key === key;
    b.setAttribute('aria-checked', on);
    b.tabIndex = on ? 0 : -1;
  });
  // keep each group reachable with Tab even when its choice isn't the current one
  if (!buttons.some((b) => b.dataset.key === key)) buttons[0].tabIndex = 0;
}

const paintCard = (key) => {
  const p = PALETTES[key];
  const colours = `--c0:${p.ground};--c1:${p.kw};--c2:${p.str};--c3:${p.fn};--c4:${p.num}`;
  return `<button type="button" class="paint" role="radio" aria-checked="false" data-key="${key}"><i style="${colours}"></i>${p.name}</button>`;
};

const choosePalette = (key) => {
  if (state.palette === key) return;
  state.palette = key;
  refresh();
  refreshChoices();
  save();
  paint(1.8);
};

const museumPaints = radioGroup($('#museum-paints'), MUSEUM, paintCard, choosePalette);
const editorPaints = radioGroup($('#editor-paints'), EDITOR, paintCard, choosePalette);
const modeButtons = radioGroup($('#modes'), Object.keys(MODES),
  (key) => `<button type="button" class="mode" role="radio" aria-checked="false" data-key="${key}">${MODES[key].name}</button>`,
  (key) => {
    if (state.mode === key && state.modeChosen) return;
    state.mode = key;
    state.modeChosen = true;
    refreshChoices();
    save();
    paint(2.4);
  });

function refreshChoices() {
  select(museumPaints, state.palette);
  select(editorPaints, state.palette);
  select(modeButtons, state.mode);

  const p = PALETTES[state.palette];
  $('#palette-note').textContent = p.group === 'editor' ? `${p.name}, by ${p.credit}.` : `${p.credit}.`;
  $('#mode-note').textContent = MODES[state.mode].hint + (state.modeChosen ? '' : ' Picked to suit your code.');
  $('#legend').innerHTML = LEGEND.map((k) =>
    `<li><i style="--c:${p[k]}"></i><span><b>${BRUSH[k].label}</b> become ${BRUSH[k].role}</span></li>`).join('');
}

// --- starting points ---

const startFrom = $('#start-from');
const starts = [
  ['', 'Choose a starting point'],
  ['sample', 'Study in Blue (a sample)'],
  ['portrait', 'Self-Portrait as a Developer'],
  ...WORKS.map((w) => [w.id, `${w.title}, ${w.id === 'quake' ? 'artist unknown' : w.artist}`]),
  ['blank', 'A blank canvas'],
];
startFrom.innerHTML = starts.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('');
startFrom.addEventListener('change', () => {
  const choice = startFrom.value;
  startFrom.value = '';
  if (choice === 'sample') load({ code: SAMPLE.code, palette: SAMPLE.palette, mode: SAMPLE.mode, modeChosen: true, title: SAMPLE.title });
  else if (choice === 'portrait') load({ code: SELF_PORTRAIT.code, palette: SELF_PORTRAIT.palette, mode: SELF_PORTRAIT.mode, modeChosen: true, title: SELF_PORTRAIT.title });
  else if (choice === 'blank') clear();
  else {
    const work = WORKS.find((w) => w.id === choice);
    if (work) openInStudio(work, false);
  }
});

function load(changes, duration = 2.6, { remember = true } = {}) {
  Object.assign(state, changes);
  textarea.value = state.code;
  textarea.scrollTop = textarea.scrollLeft = 0;
  titleInput.value = state.title;
  signatureInput.value = state.sign;
  fitTitle();
  refresh();
  refreshChoices();
  if (remember) save();
  paint(duration);
}

function clear() {
  load({ code: '', mode: 'field', modeChosen: false, title: 'Untitled' }, 0.6);
  textarea.focus();
}
$('#clear').addEventListener('click', clear);
$('#repaint').addEventListener('click', () => paint(4));

export function openInStudio(work, scroll = true) {
  load({ code: work.code, palette: work.palette, mode: work.mode, modeChosen: true, title: `${work.title}, after ${work.after}` }, 3.2);
  if (scroll) $('#studio').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
}

// someone sent a link to their painting: show it, but don't overwrite the
// visitor's own draft unless they start editing it
export async function openFromLink() {
  const shared = await paintingInLink();
  if (!shared || !PALETTES[shared.palette] || !MODES[shared.mode]) return false;
  shared.code = shared.code.slice(0, MAX_CHARS);
  load({ ...shared, modeChosen: true }, 3.2, { remember: false });
  const note = $('#shared-note');
  note.textContent = `${shared.sign || 'Someone'} shared this painting with you. Change the code and it becomes yours.`;
  note.hidden = false;
  // go straight to the painting; again once the headline fonts have
  // arrived, because they change the height of everything above it
  const show = () => $('#studio-work').scrollIntoView({ behavior: 'instant', block: 'center' });
  show();
  document.fonts.ready.then(() => requestAnimationFrame(show));
  return true;
}

// --- the label ---

// field-sizing does this in Chrome; size= is the fallback elsewhere
const fitTitle = () => {
  titleInput.size = Math.max(4, titleInput.value.length + 1);
};

// typing a name or title shouldn't rebuild the share picture on every key
let shareTimer = 0;
const prepareShareSoon = () => {
  clearTimeout(shareTimer);
  shareTimer = setTimeout(prepareShare, 600);
};

signatureInput.addEventListener('input', () => {
  state.sign = signatureInput.value;
  save();
  if (painting.resign(state.sign.trim())) prepareShareSoon();
  else painting.set({ signature: state.sign.trim() });
});

titleInput.addEventListener('input', () => {
  fitTitle();
  state.title = titleInput.value;
  save();
  refresh();
  if (painting.state === 'done') prepareShareSoon();
});

// --- saving: the painting hung on a wall, with its label underneath ---

function shorten(g, text, width) {
  if (g.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > width) t = t.slice(0, -1);
  return t + '…';
}

async function picture() {
  await Promise.race([
    Promise.all([
      document.fonts.load('italic 500 40px "Bodoni Moda"'),
      document.fonts.load('600 20px "Libre Franklin"'),
      document.fonts.load('400 20px "Libre Franklin"'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]).catch(() => {});

  const u = canvas.width / 100;
  const pad = Math.round(u * 9), rim = Math.round(u * 1.6);
  const W = canvas.width + pad * 2, H = canvas.height + pad * 2 + Math.round(u * 45);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');

  g.fillStyle = '#e6e8e3';
  g.fillRect(0, 0, W, H);
  const light = g.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.9);
  light.addColorStop(0, 'rgb(255 255 255 / 0.55)');
  light.addColorStop(1, 'rgb(255 255 255 / 0)');
  g.fillStyle = light;
  g.fillRect(0, 0, W, H);

  g.save();
  g.shadowColor = 'rgb(18 24 28 / 0.35)';
  g.shadowBlur = u * 3;
  g.shadowOffsetY = u * 1.6;
  g.fillStyle = '#17181a';
  g.fillRect(pad - rim, pad - rim, canvas.width + rim * 2, canvas.height + rim * 2);
  g.restore();
  g.drawImage(canvas, pad, pad);

  const fs = Math.round(u * 2.6);
  const sans = (weight, size) => `${weight} ${Math.round(size)}px "Libre Franklin", Arial, sans-serif`;
  const serif = (size) => `italic 500 ${Math.round(size)}px "Bodoni Moda", Georgia, serif`;
  const label = [
    [sans(600, fs), '#15191b', state.sign.trim() || 'Anonymous', 0],
    [sans(400, fs), '#4b5458', 'Active today', fs * 1.5],
    [serif(fs * 1.5), '#15191b', `${state.title.trim() || 'Untitled'}, 2026`, fs * 2.2],
    [sans(400, fs), '#4b5458', `${guessLanguage(state.code)} on silicon, in the ${PALETTES[state.palette].name} palette`, fs * 1.7],
    [sans(400, fs), '#4b5458', measure(state.code).text, fs * 1.5],
    [serif(fs * 1.05), '#15191b', 'Oil on Silicon, International Artist Day 2026', fs * 2.6],
    [sans(400, fs * 0.95), '#4b5458', `Paint your own code at ${SITE}`, fs * 1.6],
  ];
  let y = pad + canvas.height + rim + u * 9;
  for (const [font, colour, text, gap] of label) {
    y += gap;
    g.font = font;
    g.fillStyle = colour;
    g.fillText(shorten(g, text, W - pad * 2), pad, y);
  }
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}

const saveButton = $('#save');
saveButton.addEventListener('click', async () => {
  if (painting.state !== 'done') {
    statusLine.textContent = 'Let the paint dry first. You can save once the painting is finished.';
    return;
  }
  saveButton.disabled = true;
  try {
    const blob = await picture();
    const name = fileName();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    statusLine.textContent = `Saved ${name}.`;
  } catch {
    statusLine.textContent = 'The image could not be made. Try painting it again, then save.';
  } finally {
    saveButton.disabled = false;
  }
});

function fileName() {
  const slug = (state.title.trim() || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `oil-on-silicon-${slug || 'untitled'}.png`;
}

// --- sharing ---

const onPhone = matchMedia('(pointer: coarse)').matches;
const shareText = 'My code, painted. Paint yours on Oil on Silicon:';

// The link and (on phones) the picture are made as soon as a painting is
// finished. Safari only allows the share sheet straight after a tap, with
// no slow work in between.
let ready = null;
let preparing = 0;
async function prepareShare() {
  const ticket = ++preparing;
  ready = null;
  const url = await linkTo(state);
  let file = null;
  if (onPhone && navigator.canShare) {
    const blob = await picture();
    const candidate = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare({ files: [candidate] })) file = candidate;
  }
  if (ticket === preparing) ready = { url, file };
}

const shareButton = $('#share');
shareButton.addEventListener('click', async () => {
  const url = ready?.url ?? (await linkTo(state));
  if (ready?.file) {
    try {
      await navigator.share({ files: [ready.file], text: `${shareText} ${url}` });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // they closed the share sheet
    }
  }
  $('#share-url').value = url;
  $('#share-x').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  $('#share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  $('#share-links').hidden = false;
  try {
    await navigator.clipboard.writeText(url);
    statusLine.textContent = 'Link copied. Anyone who opens it sees this exact painting.';
  } catch {
    statusLine.textContent = 'Copy the link below. Anyone who opens it sees this exact painting.';
    $('#share-url').select();
  }
});

// --- first paint ---

textarea.value = state.code;
titleInput.value = state.title;
signatureInput.value = state.sign;
fitTitle();
refresh();
refreshChoices();

// lay in the underpainting now, and finish it when the studio scrolls into view
export function startStudio() {
  if (!started) {
    sized = true;
    sizeCanvas(canvas, 0.8, 1700);
    painting.set({ code: state.code, palette: state.palette, mode: state.mode, signature: state.sign.trim() });
    painting.start({ duration: speed(0.8), stopAt: reducedMotion ? null : 2 });
  }
  const finish = () => {
    if (painting.state === 'idle') paint(3.2);
    else painting.hurry(speed(3.2));
  };
  if (!('IntersectionObserver' in window)) return finish();
  const watcher = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    watcher.disconnect();
    finish();
  }, { threshold: 0.3 });
  watcher.observe(canvas.parentElement);
}
