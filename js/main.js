import { Painting, PASSES } from './painter.js';
import { PALETTES, cssVars } from './palettes.js';
import { SELF_PORTRAIT, WORKS } from './works.js';
import { $, escapeHtml, reducedMotion, storage, showCode, measure, sizeCanvas, fontsReady } from './ui.js';
import { attachLoupe, refreshLoupe } from './loupe.js';
import { startStudio, openInStudio } from './studio.js';

const speed = (seconds) => (reducedMotion ? 0 : seconds);

function setUpLights() {
  // the saved choice is applied by the inline script in <head>, before first paint
  const root = document.documentElement;
  const button = $('#lights');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme || (systemDark.matches ? 'dark' : 'light')) === 'dark';
  const label = () => {
    button.textContent = isDark() ? 'Lights on' : 'Lights off';
  };
  button.addEventListener('click', () => {
    const dark = !isDark();
    root.dataset.theme = dark ? 'dark' : 'light';
    storage.set('lights', dark ? 'off' : 'on');
    label();
  });
  systemDark.addEventListener('change', label);
  label();
}

function setUpPortrait() {
  const canvas = $('#hero canvas');
  const code = $('#hero-code');
  const status = $('#hero-status');
  code.setAttribute('style', cssVars(SELF_PORTRAIT.palette));
  const lines = showCode(code, SELF_PORTRAIT.code);
  $('#hero-dims').textContent = measure(SELF_PORTRAIT.code).text;

  let lit = null;
  let finished;
  const done = new Promise((resolve) => (finished = resolve));

  const painting = new Painting(canvas, {
    code: SELF_PORTRAIT.code,
    palette: SELF_PORTRAIT.palette,
    mode: SELF_PORTRAIT.mode,
    signature: SELF_PORTRAIT.sign,
    onPass: (p) => {
      status.textContent = PASSES[p];
    },
    // light up the line of code that is being painted
    onLine: (n) => {
      lit?.classList.remove('live');
      lit = lines[n] || null;
      lit?.classList.add('live');
    },
    onDone: (p) => {
      status.textContent = `Finished in ${p.plan.count.toLocaleString()} strokes`;
      refreshLoupe();
      finished();
    },
  });
  attachLoupe(canvas);
  $('#repaint-hero').addEventListener('click', () => painting.start({ duration: speed(5) }));

  return {
    done,
    paint() {
      sizeCanvas(canvas, SELF_PORTRAIT.aspect, 1700);
      painting.start({ duration: speed(5.5) });
    },
  };
}

function hangCollection() {
  const hang = $('#hang');
  const shape = (a) => (a > 1.05 ? 'landscape' : a < 0.95 ? 'portrait' : 'square');
  const year = (y) => escapeHtml(y).replace(/^c\. /, '<small>c.</small>').replace(/ BCE$/, ' <small>BCE</small>');

  const works = WORKS.map((w) => {
    const alt = `A painting in the ${PALETTES[w.palette].name} palette, made from ${w.title} by ${w.artist}.`;
    const note = escapeHtml(w.note).replace(/_([^_]+)_/g, '<cite>$1</cite>');
    const li = document.createElement('li');
    li.innerHTML = `
      <p class="year">${year(w.year)}</p>
      <figure class="work ${shape(w.aspect)}">
        <div class="frame ${w.frame}"><div class="slip"><div class="canvas-box" style="--ar: ${w.aspect}">
          <canvas role="img" aria-label="${escapeHtml(alt)}"></canvas>
        </div></div></div>
        <figcaption class="placard">
          <span class="artist">${escapeHtml(w.artist)}</span>
          <span class="muted">${escapeHtml(w.school)}</span>
          <span class="title"><cite>${escapeHtml(w.title)}</cite>, ${escapeHtml(w.date)}</span>
          <span class="muted">${escapeHtml(w.medium)}</span>
          <span class="muted">${measure(w.code).text}</span>
          <span class="note">${note}</span>
          <details><summary>Read the source</summary><pre class="code"></pre></details>
          <span class="foot">
            <span class="acc">Acc. no. ${escapeHtml(w.acc)}</span>
            <button class="link" type="button" data-open="${w.id}">Open in the studio</button>
          </span>
        </figcaption>
      </figure>`;
    hang.append(li);

    const source = li.querySelector('pre');
    source.setAttribute('style', cssVars(w.palette));
    showCode(source, w.code);

    const canvas = li.querySelector('canvas');
    attachLoupe(canvas);
    const painting = new Painting(canvas, {
      code: w.code, palette: w.palette, mode: w.mode, signature: w.sign, onDone: refreshLoupe,
    });
    return { w, canvas, painting, seen: false, sized: false };
  });

  const vacant = document.createElement('li');
  vacant.className = 'vacant';
  vacant.innerHTML = `
    <p class="year">2026</p>
    <div>
      <figure class="work">
        <div class="frame gilt"><div class="slip"><div class="canvas-box" style="--ar: 0.8"><span>Reserved for your work</span></div></div></div>
      </figure>
      <div class="vacant-text">
        <div class="placard">
          <span class="artist">You</span>
          <span class="muted">Active today</span>
          <span class="title"><cite>Untitled</cite>, 2026</span>
          <span class="muted">Whatever you write next</span>
          <span class="muted">Dimensions variable</span>
        </div>
        <p>This wall has room for one more.</p>
        <a class="button primary" href="#studio">Paint yours</a>
      </div>
    </div>`;
  hang.append(vacant);

  hang.addEventListener('click', (e) => {
    const button = e.target.closest('[data-open]');
    const work = button && WORKS.find((w) => w.id === button.dataset.open);
    if (work) openInStudio(work);
  });

  const size = (item) => {
    if (item.sized) return;
    sizeCanvas(item.canvas, item.w.aspect, 1400);
    item.sized = true;
  };

  // finish a painting once someone is actually looking at it
  const reveal = (item) => {
    if (item.seen) return;
    item.seen = true;
    if (item.painting.state === 'idle') {
      size(item);
      item.painting.start({ duration: speed(3.6) });
    } else {
      item.painting.hurry(speed(3.6));
    }
  };

  // meanwhile, lay in every underpainting so no frame is empty
  const underpaint = (i = 0) => {
    const item = works[i];
    if (!item) return;
    if (!item.seen && item.painting.state === 'idle') {
      size(item);
      item.painting.start({ duration: 0.8, stopAt: 2 });
    }
    setTimeout(() => underpaint(i + 1), 60);
  };

  return {
    start() {
      if (reducedMotion || !('IntersectionObserver' in window)) {
        works.forEach(reveal);
        return;
      }
      const watcher = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = works.find((x) => x.canvas.parentElement === entry.target);
          if (item) reveal(item);
          watcher.unobserve(entry.target);
        }
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.3 });
      works.forEach((item) => watcher.observe(item.canvas.parentElement));
      underpaint();
    },
  };
}

setUpLights();
const portrait = setUpPortrait();
const collection = hangCollection();

fontsReady.then(() => {
  portrait.paint();
  // the rest of the page waits for the self-portrait, so the first painting is quick
  const wait = new Promise((resolve) => setTimeout(resolve, speed(6.5) * 1000));
  Promise.race([portrait.done, wait]).then(() => {
    collection.start();
    startStudio();
  });
});
