import { hash, rng, gauss, clamp, makeNoise } from './rand.js';
import { tokenize } from './syntax.js';
import { BRUSH, palette, rgbToHsl, mixRgb, hsla } from './palettes.js';

// Positions are in canvas heights: y runs 0..1 and x runs 0..A (the aspect
// ratio), so a painting comes out the same at any resolution.

export const PASSES = [
  'Sketching the underdrawing',
  'Laying the underpainting',
  'Painting in colour',
  'Glazing',
  'Adding detail',
];

export const MODES = {
  field: { name: 'Field', hint: 'Each line of code becomes a horizon.' },
  vortex: { name: 'Vortex', hint: 'Every function becomes a whirlpool.' },
  cascade: { name: 'Cascade', hint: 'The code falls like rain, top to bottom.' },
  bloom: { name: 'Bloom', hint: 'Tokens grow outward like the seeds in a sunflower.' },
  mosaic: { name: 'Mosaic', hint: 'One painted tile for every token.' },
};

export const MAX_CHARS = 6000;
const STEP = 0.0034; // how far a brush moves per step

export function pickMode(code) {
  const fns = tokenize(code.slice(0, MAX_CHARS)).filter((t) => t.kind === 'fn').map((t) => t.text);
  if (fns.some((f, i) => fns.indexOf(f) !== i)) return 'vortex'; // something calls itself
  if (code.split('\n').length <= 6) return 'field';
  return ['field', 'cascade', 'bloom', 'mosaic'][hash(code) % 4];
}

function flowField(mode, r, A, fnSpots, centre) {
  const noise = makeNoise(r);
  const f = 1.25 + r() * 1.1;
  const ox = r() * 50, oy = r() * 50;
  const n = (x, y) => noise(x * f + ox, y * f + oy);

  if (mode === 'vortex') {
    // whirlpools sit where the functions are, at least two of them
    const eddies = [];
    for (const s of fnSpots) {
      if (eddies.length >= 3) break;
      if (eddies.every((e) => Math.hypot(e.x - s.x, e.y - s.y) > 0.24)) eddies.push({ x: s.x, y: s.y });
    }
    while (eddies.length < 2) eddies.push({ x: (0.18 + r() * 0.64) * A, y: 0.18 + r() * 0.64 });
    eddies.forEach((e, i) => {
      e.r = 0.17 + r() * 0.16;
      e.spin = i % 2 ? -1 : 1;
      e.pull = 1.7 + r() * 1.3;
      e.inward = 0.1 + r() * 0.14;
    });
    const drift = (r() - 0.5) * 0.6;
    const dx0 = Math.cos(drift) * 0.32, dy0 = Math.sin(drift) * 0.32;

    return (x, y) => {
      let vx = dx0, vy = dy0;
      for (const e of eddies) {
        const dx = x - e.x, dy = y - e.y;
        const d2 = dx * dx + dy * dy;
        const fall = Math.exp(-d2 / (e.r * e.r)) * e.pull;
        const d = Math.sqrt(d2) + 1e-4;
        const c = Math.cos(e.inward), s = Math.sin(e.inward);
        vx += ((-dy / d) * e.spin * c - (dx / d) * s) * fall;
        vy += ((dx / d) * e.spin * c - (dy / d) * s) * fall;
      }
      const t = n(x, y) * 2.4;
      vx += Math.cos(t) * 0.3;
      vy += Math.sin(t) * 0.3;
      return Math.atan2(vy, vx);
    };
  }
  if (mode === 'cascade') {
    const sway = 6 + r() * 6, phase = r() * 6.283;
    return (x, y) => Math.PI / 2 + n(x, y) * 0.62 + Math.sin(x * sway + phase) * 0.18;
  }
  if (mode === 'bloom') {
    const spin = (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.35);
    return (x, y) => Math.atan2(y - centre.y, x - centre.x) + spin + n(x, y) * 0.55;
  }
  if (mode === 'mosaic') return (x, y) => n(x, y) * 0.3;

  const tilt = (r() - 0.5) * 0.3, waves = 2 + r() * 3, phase = r() * 6.283, amp = 1.1 + r() * 0.5;
  return (x, y) => tilt + Math.sin(y * waves + phase + x * 0.8) * 0.2 + n(x, y) * amp;
}

// Turn code into a list of brush strokes, grouped by pass
export function plan(code, mode, A) {
  const src = (code || '').slice(0, MAX_CHARS);
  const toks = tokenize(src).filter((t) => t.kind !== 'ws' && t.kind !== 'nl');
  const lines = src.split('\n');
  const nLines = Math.max(1, lines.length);
  let maxCols = 12;
  for (const l of lines) {
    let c = 0;
    for (const ch of l) c += ch === '\t' ? 4 - (c % 4) : 1;
    maxCols = Math.max(maxCols, c);
  }

  const seed = hash(mode + '␟' + src);
  const r = rng(seed);
  const N = toks.length;
  const mx = 0.075 * A, my = 0.07;
  const colW = (A - 2 * mx) / maxCols;
  const lineH = (1 - 2 * my) / nLines;
  const centre = { x: A / 2 + (r() - 0.5) * 0.06, y: 0.5 + (r() - 0.5) * 0.06 };

  // mosaic: a roughly square grid, one tile per token
  const gcols = Math.max(1, Math.round(Math.sqrt(N * A)));
  const grows = Math.max(1, Math.ceil(N / gcols));
  const tile = Math.min((A - 2 * mx) / gcols, (1 - 2 * my) / grows);
  const gx0 = (A - tile * gcols) / 2, gy0 = (1 - tile * grows) / 2;

  // where each token's strokes start
  toks.forEach((t, i) => {
    t.idx = i;
    if (mode === 'bloom') {
      const rad = 0.47 * Math.sqrt((i + 0.6) / Math.max(1, N));
      const ang = i * 2.39996323; // golden angle
      t.ax = centre.x + Math.cos(ang) * rad;
      t.ay = centre.y + Math.sin(ang) * rad;
    } else if (mode === 'mosaic') {
      t.gc = i % gcols;
      t.gr = Math.floor(i / gcols);
      t.ax = gx0 + (t.gc + 0.5) * tile;
      t.ay = gy0 + (t.gr + 0.5) * tile;
    } else if (mode === 'cascade') {
      t.ax = mx + (t.line + 0.5) * ((A - 2 * mx) / nLines); // one column of rain per line
      t.ay = my + ((t.col + t.text.length / 2) / maxCols) * 0.62;
    } else {
      t.ax = mx + (t.col + t.text.length / 2) * colW;
      t.ay = my + (t.line + 0.5) * lineH;
    }
  });

  const fnSpots = toks.filter((t) => t.kind === 'fn').map((t) => ({ x: t.ax, y: t.ay }));
  const field = flowField(mode, r, A, fnSpots, centre);

  // small programs get big brushes, big programs get fine ones
  const lenScale = clamp(1.55 - N / 260, 0.78, 1.55);
  const widScale = clamp(1.45 - N / 320, 0.75, 1.45);
  const budget = Math.round(clamp(260 + N * 10, 360, 1400));
  const mosaic = mode === 'mosaic';
  const bandW = (A - 2 * mx) / nLines;
  const spreadX = (t) => {
    if (mosaic) return tile * 0.16;
    if (mode === 'bloom') return 0.018;
    if (mode === 'cascade') return Math.max(0.012, bandW * 0.32);
    return Math.max(0.014, colW * (t.text.length + 3) * 0.45);
  };
  const spreadY = (t) => {
    if (mosaic) return tile * 0.16;
    if (mode === 'bloom') return 0.018;
    if (mode === 'cascade') return 0.05;
    return Math.max(0.01, lineH * 0.45);
  };
  const longer = mode === 'cascade' ? 1.6 : 1;
  const direction = () => (mode === 'cascade' || mode === 'bloom' ? 1 : r() < 0.5 ? -1 : 1);
  const commentText = (t) => t.text.replace(/^\s*(\/\/+|#+|--|\/\*+|\*+)\s?/, '').replace(/\*\/\s*$/, '');
  const weight = (t) => BRUSH[t.kind].wt * (1 + Math.min(t.text.length, 14) * 0.08);

  // split `total` strokes between tokens by weight, rounding at random
  const share = (list, total) => {
    const ws = list.map(weight);
    const sum = ws.reduce((a, b) => a + b, 0);
    if (!sum) return list.map(() => 0);
    return ws.map((w) => {
      const exact = (total * w) / sum;
      const whole = Math.floor(exact);
      return whole + (r() < exact - whole ? 1 : 0);
    });
  };

  const passes = [[], [], [], [], []];
  const add = (pass, t, s) => passes[pass].push({
    pass, line: t.line, k: t.kind, i: t.idx,
    g: '', gs: 0, gr: 0, ga: 0, tint: 0, ang: null, text: false, shadow: false, flat: false,
    dh: gauss(r) * 4, ds: gauss(r) * 6, dl: gauss(r) * 5, ph: r() * 6.283,
    ...s,
  });

  // 1. underdrawing: brackets and punctuation, in charcoal
  if (mosaic) {
    const pen = { line: 0, kind: 'pun', idx: 0 };
    for (let row = 0; row <= grows; row++) add(0, pen, { x: gx0, y: gy0 + row * tile, L: tile * gcols, w: 0.0016, a: 0.35, ang: 0, dir: 1 });
    for (let col = 0; col <= gcols; col++) add(0, pen, { x: gx0 + col * tile, y: gy0, L: tile * grows, w: 0.0016, a: 0.35, ang: Math.PI / 2, dir: 1 });
  } else {
    for (const t of toks) {
      if (t.kind !== 'pun') continue;
      const count = r() < 0.5 ? 2 : 1;
      for (let j = 0; j < count; j++) {
        add(0, t, {
          x: t.ax + gauss(r) * spreadX(t) * 1.3, y: t.ay + gauss(r) * spreadY(t) * 1.3,
          L: (0.1 + r() * 0.13) * lenScale, w: 0.0012 + r() * 0.0013, a: 0.3 + r() * 0.25, dir: direction(),
        });
      }
    }
  }

  // 2. underpainting: a few broad, thin washes
  if (N) {
    const count = Math.round(clamp(30 + N * 0.35, 36, 110));
    let sum = 0;
    const cumulative = toks.map((t) => (sum += BRUSH[t.kind].wt));
    for (let j = 0; j < count; j++) {
      const pick = r() * sum;
      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] < pick) lo = mid + 1; else hi = mid;
      }
      const t = toks[lo];
      add(1, t, {
        x: t.ax + gauss(r) * spreadX(t) * 2, y: t.ay + gauss(r) * spreadY(t) * 2,
        L: (0.25 + r() * 0.3) * lenScale, w: (0.06 + r() * 0.06) * widScale,
        a: 0.08 + r() * 0.07, tint: 0.35, dir: direction(),
      });
    }
    passes[1].sort((a, b) => a.line - b.line || a.i - b.i);
  }

  // 3. body colour. Each stroke carries its token's text as bristle marks
  if (mosaic) {
    for (const t of toks) {
      const rows = r() < 0.5 ? 4 : 3;
      const left = gx0 + t.gc * tile, top = gy0 + t.gr * tile;
      for (let j = 0; j < rows; j++) {
        const w = (tile / rows) * 1.35;
        add(2, t, {
          x: left + tile * 0.05, y: top + (tile * (j + 0.5)) / rows + gauss(r) * tile * 0.02,
          L: tile * 0.9, w, a: t.kind === 'com' ? 0.55 : 0.9, ang: gauss(r) * 0.04, dir: 1,
          shadow: true, flat: true,
          g: t.kind === 'com' ? commentText(t) : t.text, gs: clamp(w * 0.34, 0.004, 0.012), gr: 2, ga: 0.5,
        });
      }
    }
  } else {
    const body = toks.filter((t) => 'kw fn type str id'.includes(t.kind));
    const counts = share(body, Math.round(budget * 0.52));
    body.forEach((t, n) => {
      const B = BRUSH[t.kind];
      for (let j = 0; j < counts[n]; j++) {
        const w = 0.0155 * B.w * (0.7 + r() * 0.6) * widScale;
        add(2, t, {
          x: t.ax + gauss(r) * spreadX(t), y: t.ay + gauss(r) * spreadY(t),
          L: 0.11 * B.len * (0.6 + r() * 0.8) * lenScale * longer,
          w, a: B.a * (0.85 + r() * 0.15), dir: direction(), shadow: t.kind !== 'str',
          g: t.text, gs: clamp(w * 0.36, 0.0058, 0.0115), gr: w > 0.02 ? 3 : 2, ga: 0.5,
        });
      }
    });
  }

  // 4. glazes: comments, thin and see-through
  for (const t of toks) {
    if (t.kind !== 'com') continue;
    const words = commentText(t);
    const count = clamp(Math.round(t.text.length / 10), 2, 7);
    for (let j = 0; j < count; j++) {
      add(3, t, {
        x: t.ax + gauss(r) * spreadX(t) * 1.4, y: t.ay + gauss(r) * spreadY(t) * 1.4,
        L: (0.2 + r() * 0.25) * lenScale, w: (0.035 + r() * 0.035) * widScale,
        a: 0.1 + r() * 0.07, dir: direction(), g: words, gs: 0.0072, gr: 3, ga: 0.22,
      });
    }
  }

  // 5. detail: the tokens written out in full, plus dabs and accents
  const rest = toks.filter((t) => t.kind !== 'com');
  if (mosaic) {
    for (const t of rest) {
      const left = gx0 + t.gc * tile;
      const gs = clamp(tile * 0.17, 0.006, 0.034);
      const L = Math.min(tile * 0.84, (t.text.length + 0.4) * gs * 0.62);
      add(4, t, { x: left + (tile - L) / 2, y: t.ay, L, w: gs * 0.9, a: 0.95, ang: 0, dir: 1, text: true, g: t.text, gs, gr: 1, ga: 0.95 });
    }
  } else {
    const counts = share(rest, Math.round(budget * 0.48));
    rest.forEach((t, n) => {
      for (let j = 0; j < counts[n]; j++) {
        const at = { x: t.ax + gauss(r) * spreadX(t) * 0.9, y: t.ay + gauss(r) * spreadY(t) * 0.9, dir: direction(), g: t.text };
        if (t.kind === 'num') {
          const w = (0.012 + r() * 0.009) * widScale;
          add(4, t, { ...at, L: 0.012 + r() * 0.014, w, a: 0.95, shadow: true, gs: clamp(w * 0.5, 0.005, 0.012), gr: 1, ga: 0.7 });
        } else if (t.kind === 'op') {
          add(4, t, { ...at, L: 0.02 + r() * 0.03, w: 0.0035 + r() * 0.0028, a: 1, text: true, gs: 0.0078, gr: 1, ga: 1 });
        } else if (t.kind === 'pun') {
          add(4, t, { ...at, L: 0.03 + r() * 0.05, w: 0.0018, a: 0.6, text: true, gs: 0.0064, gr: 1, ga: 0.7 });
        } else {
          add(4, t, { ...at, L: (0.07 + r() * 0.09) * lenScale, w: 0.0035 + r() * 0.003, a: 0.92, text: true, gs: 0.0082 + r() * 0.0014, gr: 1, ga: 0.95 });
        }
      }
    });
  }

  return { passes, field, A, seed, count: passes.reduce((s, p) => s + p.length, 0) };
}

// --- brushwork ---

function follow(field, x, y, L, dir, A) {
  const steps = Math.max(2, Math.round(L / STEP));
  const pts = [];
  const flip = dir < 0 ? Math.PI : 0;
  for (let i = 0; i <= steps; i++) {
    const th = field(x, y);
    pts.push(x, y, th + flip);
    // midpoint step, so tight curls don't spiral outwards
    const th2 = field(x + Math.cos(th) * STEP * 0.5 * dir, y + Math.sin(th) * STEP * 0.5 * dir);
    x += Math.cos(th2) * STEP * dir;
    y += Math.sin(th2) * STEP * dir;
    if (x < -0.06 || x > A + 0.06 || y < -0.06 || y > 1.06) break;
  }
  return pts;
}

function straight(s) {
  const steps = Math.max(2, Math.round(s.L / STEP));
  const step = s.L / steps;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const bend = Math.sin((i / steps) * Math.PI) * 0.02 * Math.sin(s.ph);
    pts.push(s.x + Math.cos(s.ang) * step * i, s.y + Math.sin(s.ang) * step * i, s.ang + bend);
  }
  return pts;
}

// brush pressure along a stroke, 0..1 → width factor
function pressure(t, ph, flat) {
  if (flat) {
    const edge = t < 0.05 ? 0.75 + 5 * t : t > 0.95 ? 0.75 + 5 * (1 - t) : 1;
    return edge * (1 + 0.05 * Math.sin(t * 9 + ph));
  }
  const attack = Math.min(1, t / 0.12);
  const release = t > 0.6 ? 1 - ((t - 0.6) / 0.4) * 0.82 : 1; // dry brush at the end
  return (0.35 + 0.65 * Math.sqrt(attack)) * release * (1 + 0.1 * Math.sin(t * 7 + ph));
}

function outline(ctx, pts, n, wpx, S, ox, oy, ph, flat) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const w = wpx * pressure(i / (n - 1), ph, flat) * 0.5;
    const th = pts[i * 3 + 2];
    const x = pts[i * 3] * S + ox, y = pts[i * 3 + 1] * S + oy;
    const nx = -Math.sin(th) * w, ny = Math.cos(th) * w;
    if (i === 0) ctx.moveTo(x + nx, y + ny);
    else ctx.lineTo(x + nx, y + ny);
  }
  for (let i = n - 1; i >= 0; i--) {
    const w = wpx * pressure(i / (n - 1), ph, flat) * 0.5;
    const th = pts[i * 3 + 2];
    ctx.lineTo(pts[i * 3] * S + ox + Math.sin(th) * w, pts[i * 3 + 1] * S + oy - Math.cos(th) * w);
  }
  ctx.closePath();
}

// setting ctx.font is slow, and most strokes reuse the last size
const fontOf = new WeakMap();

// write the token along the stroke, one character at a time
function letters(ctx, pts, n, s, S, wpx, fill, insideOnly) {
  const size = s.gs * S;
  if (size < 2.5 || !s.g) return;
  const text = s.g.replace(/\s+/g, ' ').trim();
  if (!text) return;
  const cycle = text + ' ';
  const font = Math.round(size) + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';
  if (fontOf.get(ctx) !== font) {
    ctx.font = font;
    fontOf.set(ctx, font);
  }
  ctx.fillStyle = fill;

  const dist = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    dist[i] = dist[i - 1] + Math.hypot((pts[i * 3] - pts[(i - 1) * 3]) * S, (pts[i * 3 + 1] - pts[(i - 1) * 3 + 1]) * S);
  }
  const total = dist[n - 1];
  const advance = size * 0.62;
  const count = Math.floor(total / advance);
  if (count < 1) return;
  // keep the text reading left to right even when the brush moves right to left
  const backwards = pts[(n - 1) * 3] < pts[0];

  for (let row = 0; row < s.gr; row++) {
    const off = (row - (s.gr - 1) / 2) * size * 1.12;
    let seg = 1;
    for (let k = 0; k < count; k++) {
      const d = backwards ? total - (k + 0.5) * advance : (k + 0.5) * advance;
      if (backwards) {
        while (seg > 1 && dist[seg - 1] > d) seg--;
        while (seg < n - 1 && dist[seg] < d) seg++;
      } else {
        while (seg < n - 1 && dist[seg] < d) seg++;
      }
      const i0 = seg - 1, i1 = seg;
      const f = clamp((d - dist[i0]) / (dist[i1] - dist[i0] || 1), 0, 1);
      if (insideOnly) {
        const half = wpx * pressure((i0 + f) / (n - 1), s.ph, s.flat) * 0.5;
        if (Math.abs(off) + size * 0.36 > half) continue;
      }
      const x = (pts[i0 * 3] + (pts[i1 * 3] - pts[i0 * 3]) * f) * S;
      const y = (pts[i0 * 3 + 1] + (pts[i1 * 3 + 1] - pts[i0 * 3 + 1]) * f) * S;
      let th = Math.atan2(pts[i1 * 3 + 1] - pts[i0 * 3 + 1], pts[i1 * 3] - pts[i0 * 3]);
      if (backwards) th += Math.PI;
      const c = Math.cos(th), sn = Math.sin(th);
      ctx.setTransform(c, sn, -sn, c, x - sn * off, y + c * off);
      ctx.fillText(cycle[k % cycle.length], 0, 0);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function stroke(ctx, s, P, pal, S) {
  const pts = s.ang != null ? straight(s) : follow(P.field, s.x, s.y, s.L, s.dir, P.A);
  const n = pts.length / 3;
  if (n < 2) return;

  const base = s.tint ? rgbToHsl(mixRgb(pal.rgb[s.k], pal.groundRgb, s.tint)) : pal.hsl[s.k];
  const col = { h: (base.h + s.dh + 360) % 360, s: base.s + s.ds, l: base.l + s.dl };
  const glow = pal.glow && s.pass >= 2 ? 0.7 : 1;
  const wpx = s.w * S;

  if (s.text) {
    outline(ctx, pts, n, wpx, S, 0, 0, s.ph, s.flat);
    ctx.fillStyle = hsla(col, s.a * 0.32 * glow);
    ctx.fill();
    letters(ctx, pts, n, s, S, wpx, hsla(col, s.ga * glow), false);
    return;
  }

  // impasto: a soft shadow under the paint, a highlight along the ridge
  if (s.shadow && !pal.glow) {
    outline(ctx, pts, n, wpx, S, S * 0.0011, S * 0.0016, s.ph, s.flat);
    ctx.fillStyle = hsla({ h: col.h, s: col.s * 0.7, l: col.l * 0.45 }, s.a * 0.3);
    ctx.fill();
  }
  outline(ctx, pts, n, wpx, S, 0, 0, s.ph, s.flat);
  ctx.fillStyle = hsla(col, s.a * glow);
  ctx.fill();

  if (s.shadow && wpx > 3) {
    ctx.beginPath();
    const lx = -0.12 * wpx, ly = -0.16 * wpx; // light comes from the top left
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3] * S + lx, y = pts[i * 3 + 1] * S + ly;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = wpx * 0.16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = hsla({ h: col.h, s: col.s * 0.8, l: Math.min(96, col.l + 18) }, 0.22 * s.a);
    ctx.stroke();
  }

  if (s.g && s.gr) {
    const l = col.l > 55 ? col.l - 26 : col.l + 26;
    letters(ctx, pts, n, s, S, wpx, hsla({ h: col.h, s: col.s * 0.85, l }, s.ga * glow), true);
  }
}

// --- canvas, varnish, signature ---

const weave = {};
function weaveTile(dark) {
  if (weave[dark]) return weave[dark];
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  const r = rng(dark ? 7 : 11);
  const ink = dark ? '255,255,255' : '0,0,0';
  g.fillStyle = dark ? '#000' : '#fff';
  g.fillRect(0, 0, 96, 96);
  for (let y = 0; y < 96; y += 3) {
    g.fillStyle = `rgba(${ink},${0.1 + r() * 0.12})`;
    g.fillRect(0, y, 96, 1.4);
  }
  for (let x = 0; x < 96; x += 3) {
    g.fillStyle = `rgba(${ink},${0.06 + r() * 0.1})`;
    g.fillRect(x, 0, 1.2, 96);
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(${ink},${r() * 0.22})`;
    g.fillRect(Math.floor(r() * 96), Math.floor(r() * 96), 1, 1);
  }
  return (weave[dark] = c);
}

function prime(ctx, W, H, pal, r) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, 0, W, H);
  // uneven priming
  const g = rgbToHsl(pal.groundRgb);
  for (let i = 0; i < 8; i++) {
    const x = r() * W, y = r() * H, rad = (0.25 + r() * 0.5) * Math.max(W, H);
    const c = { h: g.h, s: g.s, l: g.l + (r() - 0.5) * (pal.dark ? 6 : 8) };
    const blot = ctx.createRadialGradient(x, y, 0, x, y, rad);
    blot.addColorStop(0, hsla(c, 0.5));
    blot.addColorStop(1, hsla(c, 0));
    ctx.fillStyle = blot;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  ctx.globalCompositeOperation = pal.dark ? 'screen' : 'multiply';
  ctx.globalAlpha = pal.dark ? 0.16 : 0.2;
  ctx.fillStyle = ctx.createPattern(weaveTile(pal.dark), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function varnish(ctx, W, H, pal) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // the weave shows through the paint a little
  ctx.globalCompositeOperation = pal.dark ? 'screen' : 'multiply';
  ctx.globalAlpha = pal.dark ? 0.07 : 0.1;
  ctx.fillStyle = ctx.createPattern(weaveTile(pal.dark), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, pal.dark ? 'rgba(0,0,0,0.42)' : 'rgba(70,50,30,0.18)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function sign(ctx, W, H, name, pal) {
  if (!name) return;
  const family = '"Herr Von Muellerhoff", "Snell Roundhand", "Apple Chancery", cursive';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  let size = Math.round(H * 0.064);
  ctx.font = `${size}px ${family}`;
  const room = W * 0.44, width = ctx.measureText(name).width;
  if (width > room) {
    size = Math.max(10, Math.floor((size * room) / width));
    ctx.font = `${size}px ${family}`;
  }
  ctx.textAlign = 'right';
  ctx.translate(W * 0.95, H * 0.955);
  ctx.rotate(-0.07);
  ctx.fillStyle = pal.sign || pal.num;
  ctx.globalAlpha = 0.92;
  ctx.fillText(name, 0, 0);
  ctx.restore();
}

// Paints a plan onto a canvas a few strokes per frame. `stopAt` pauses before
// a pass, so a painting can sit at its underpainting until someone looks at it.
export class Painting {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    // willReadFrequently keeps this canvas on the CPU rasteriser. The GPU path
    // took ~12s for the ~40k tiny rotated letters in one painting; this is ~0.5s.
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.state = 'idle';
    this.pass = -1;
    this.tick = this.tick.bind(this);
    Object.assign(this, opts);
  }

  set(opts) {
    Object.assign(this, opts);
    return this;
  }

  start({ duration = 4, stopAt = null } = {}) {
    this.cancel();
    const W = this.canvas.width, H = this.canvas.height;
    this.plan = plan(this.code, this.mode, W / H);
    this.pal = palette(this.palette);
    this.steps = this.run(W, H);
    this.painted = 0;
    this.lastLine = -1;
    this.stopAt = stopAt;
    this.pace(duration);
    this.state = 'running';
    this.raf = requestAnimationFrame(this.tick);
  }

  pace(duration) {
    const left = Math.max(1, this.plan.count - this.painted);
    this.perFrame = duration > 0 ? Math.max(1, Math.ceil(left / (duration * 60))) : Infinity;
    this.budget = duration > 0 ? 10 : 30; // ms per frame
  }

  resume({ duration = 3 } = {}) {
    if (this.state !== 'paused') return;
    this.stopAt = null;
    this.pace(duration);
    this.state = 'running';
    this.onPass?.(this.pass, this);
    this.raf = requestAnimationFrame(this.tick);
  }

  // finish a painting that is still being prepared in the background
  hurry(duration) {
    if (this.state === 'paused') return this.resume({ duration });
    if (this.state === 'running') {
      this.stopAt = null;
      this.pace(duration);
    }
  }

  cancel() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.steps = null;
    if (this.state !== 'done') this.state = 'idle';
  }

  *run(W, H) {
    const ctx = this.ctx;
    prime(ctx, W, H, this.pal, rng(this.plan.seed ^ 0x9e3779b9));
    for (let p = 0; p < this.plan.passes.length; p++) {
      yield { pass: p };
      ctx.globalCompositeOperation = this.pal.glow && p >= 2 ? 'lighter' : 'source-over';
      for (const s of this.plan.passes[p]) {
        stroke(ctx, s, this.plan, this.pal, H);
        yield s;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    varnish(ctx, W, H, this.pal);
    if (this.keepUnsigned) {
      // so a new signature doesn't need a full repaint
      this.unsigned ??= document.createElement('canvas');
      this.unsigned.width = W;
      this.unsigned.height = H;
      this.unsigned.getContext('2d').drawImage(this.canvas, 0, 0);
    }
    sign(ctx, W, H, this.signature, this.pal);
  }

  tick() {
    if (this.state !== 'running' || !this.steps) return;
    const t0 = performance.now();
    let done = 0, line = this.lastLine;
    for (;;) {
      const { value, done: finished } = this.steps.next();
      if (finished) {
        this.state = 'done';
        this.steps = null;
        this.onLine?.(-1, this);
        this.onDone?.(this);
        return;
      }
      if (value.k === undefined) {
        // start of a new pass
        this.pass = value.pass;
        if (this.stopAt != null && value.pass >= this.stopAt) {
          this.state = 'paused';
          return;
        }
        this.onPass?.(value.pass, this);
        continue;
      }
      this.painted++;
      done++;
      line = value.line;
      if (done >= this.perFrame || performance.now() - t0 > this.budget) break;
    }
    if (line !== this.lastLine) {
      this.lastLine = line;
      this.onLine?.(line, this);
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  resign(name) {
    this.signature = name;
    if (this.state !== 'done' || !this.unsigned) return false;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.unsigned, 0, 0);
    sign(ctx, this.canvas.width, this.canvas.height, name, this.pal);
    return true;
  }
}
