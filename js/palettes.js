import { clamp } from './rand.js';

// Each palette maps token kinds to paint. The museum ones are named after
// real pigments of the period; the editor themes use their published colours.
export const PALETTES = {
  pigments: {
    name: 'Pigments', credit: 'Ultramarine, cadmium and vermilion on ivory black', group: 'museum',
    ground: '#16161b', fg: '#e8e1d0', sel: '#2c2d38', sign: '#ea4a2c',
    kw: '#3a5ce4', fn: '#e2607f', str: '#f0c03a', num: '#ea4a2c', com: '#2f9c7d',
    type: '#52b1e2', id: '#d9cdb2', op: '#f6dd9b', pun: '#6b7684',
  },
  fresco: {
    name: 'Fresco', credit: 'Earth pigments and Egyptian blue on lime plaster', group: 'museum',
    ground: '#e6dcc8', fg: '#3a2f27', sel: '#d6cbb4', sign: '#a3412a',
    kw: '#2a5ba8', fn: '#a3412a', str: '#c9993a', num: '#c43a22', com: '#7f9170',
    type: '#8a4b2b', id: '#6e5a46', op: '#2b2622', pun: '#5a4e45',
  },
  nocturne: {
    name: 'Nocturne', credit: 'Prussian blue night with chrome yellow', group: 'museum',
    ground: '#0f1b2a', fg: '#d8d0bd', sel: '#1d2c40', sign: '#e6b83c',
    kw: '#e6b83c', fn: '#56b48f', str: '#d77f93', num: '#e85a3c', com: '#cfc7b2',
    type: '#6d8fe0', id: '#c4bba3', op: '#f2e7c6', pun: '#56657a',
  },
  midcentury: {
    name: 'Mid-century', credit: 'Mustard, teal and walnut on paper', group: 'museum',
    ground: '#eee4cf', fg: '#2c2a26', sel: '#e0d4bb', sign: '#2c2a26',
    kw: '#d9541e', fn: '#2a7a76', str: '#8b9a52', num: '#b8322a', com: '#a9a58c',
    type: '#2f4f74', id: '#e0a32a', op: '#262420', pun: '#6a645a',
  },
  phosphor: {
    name: 'Phosphor', credit: 'P1 green on cathode-ray glass', group: 'museum', glow: true,
    ground: '#050906', fg: '#7dffa8', sel: '#0f2416', sign: '#b9ffcf',
    kw: '#b9ffcf', fn: '#4dff8f', str: '#2fd06e', num: '#e8fff0', com: '#1d7a43',
    type: '#8affb5', id: '#25b25f', op: '#d4ffe1', pun: '#1a6b3b',
  },
  press: {
    name: 'Press', credit: 'Cover blue and black ink on book paper', group: 'museum',
    ground: '#f2f0e9', fg: '#1d1d1f', sel: '#dfe6f2', sign: '#1f5fb8',
    kw: '#1f5fb8', fn: '#1f5fb8', str: '#4a84d4', num: '#1a1a1c', com: '#9aa6b8',
    type: '#173f7a', id: '#2a2a2d', op: '#1a1a1c', pun: '#80858e',
  },
  arena: {
    name: 'Arena', credit: 'Rust, brass and gunmetal', group: 'museum',
    ground: '#191a1d', fg: '#e3d6b8', sel: '#2a2b30', sign: '#ff7a1c',
    kw: '#ff7a1c', fn: '#e0632e', str: '#d4ad55', num: '#e8321f', com: '#5d656e',
    type: '#cf7b45', id: '#b48a58', op: '#f4e3bd', pun: '#4a4d52',
  },
  monokai: {
    name: 'Monokai', credit: 'Wimer Hazenberg, 2006', group: 'editor',
    ground: '#272822', fg: '#f8f8f2', sel: '#49483e', sign: '#f92672',
    kw: '#f92672', fn: '#a6e22e', str: '#e6db74', num: '#ae81ff', com: '#75715e',
    type: '#66d9ef', id: '#f8f8f2', op: '#f92672', pun: '#cfcfc2',
  },
  dracula: {
    name: 'Dracula', credit: 'Zeno Rocha', group: 'editor',
    ground: '#282a36', fg: '#f8f8f2', sel: '#44475a', sign: '#ff79c6',
    kw: '#ff79c6', fn: '#50fa7b', str: '#f1fa8c', num: '#bd93f9', com: '#6272a4',
    type: '#8be9fd', id: '#f8f8f2', op: '#ff79c6', pun: '#c6c8d4',
  },
  solarized: {
    name: 'Solarized', credit: 'Ethan Schoonover, 2011', group: 'editor',
    ground: '#002b36', fg: '#93a1a1', sel: '#073642', sign: '#cb4b16',
    kw: '#859900', fn: '#268bd2', str: '#2aa198', num: '#d33682', com: '#586e75',
    type: '#b58900', id: '#93a1a1', op: '#cb4b16', pun: '#657b83',
  },
  nord: {
    name: 'Nord', credit: 'Arctic Ice Studio, 2016', group: 'editor',
    ground: '#2e3440', fg: '#d8dee9', sel: '#434c5e', sign: '#88c0d0',
    kw: '#81a1c1', fn: '#88c0d0', str: '#a3be8c', num: '#b48ead', com: '#616e88',
    type: '#8fbcbb', id: '#d8dee9', op: '#81a1c1', pun: '#eceff4',
  },
  gruvbox: {
    name: 'Gruvbox', credit: 'morhetz, 2012', group: 'editor',
    ground: '#282828', fg: '#ebdbb2', sel: '#3c3836', sign: '#fe8019',
    kw: '#fb4934', fn: '#fabd2f', str: '#b8bb26', num: '#d3869b', com: '#928374',
    type: '#83a598', id: '#ebdbb2', op: '#fe8019', pun: '#a89984',
  },
};

export const KINDS = ['kw', 'fn', 'type', 'str', 'id', 'num', 'op', 'com', 'pun'];

// w/len: brush size relative to the others, a: opacity, wt: share of the strokes
export const BRUSH = {
  kw:   { w: 1.00, len: 1.00, a: 0.92, wt: 1.25, label: 'Keywords',  role: 'bold strokes' },
  fn:   { w: 1.15, len: 1.45, a: 0.92, wt: 1.45, label: 'Functions', role: 'sweeping strokes' },
  type: { w: 1.05, len: 1.10, a: 0.90, wt: 1.20, label: 'Types',     role: 'structural strokes' },
  str:  { w: 1.30, len: 1.35, a: 0.62, wt: 1.05, label: 'Strings',   role: 'long washes' },
  id:   { w: 0.78, len: 0.90, a: 0.86, wt: 0.85, label: 'Names',     role: 'body colour' },
  num:  { w: 0.95, len: 0.16, a: 0.96, wt: 1.00, label: 'Numbers',   role: 'dabs' },
  op:   { w: 0.42, len: 0.34, a: 1.00, wt: 0.45, label: 'Operators', role: 'accents' },
  com:  { w: 2.60, len: 1.60, a: 0.13, wt: 0.90, label: 'Comments',  role: 'glazes' },
  pun:  { w: 0.16, len: 0.85, a: 0.45, wt: 0.30, label: 'Brackets',  role: 'underdrawing' },
};

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

export const mixRgb = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });

export const hsla = (c, a) =>
  `hsla(${c.h.toFixed(1)},${clamp(c.s, 0, 100).toFixed(1)}%,${clamp(c.l, 0, 100).toFixed(1)}%,${clamp(a, 0, 1).toFixed(3)})`;

const luma = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// the painter wants rgb + hsl for every kind; work it out once per palette
const prepared = new Map();
export function palette(key) {
  if (prepared.has(key)) return prepared.get(key);
  const p = { ...(Object.hasOwn(PALETTES, key) ? PALETTES[key] : PALETTES.pigments) };
  p.groundRgb = hexToRgb(p.ground);
  p.dark = luma(p.groundRgb) < 0.45;
  p.rgb = {};
  p.hsl = {};
  for (const k of KINDS) {
    p.rgb[k] = hexToRgb(p[k]);
    p.hsl[k] = rgbToHsl(p.rgb[k]);
  }
  prepared.set(key, p);
  return p;
}

// --- code labels and the editor show the palette as CSS variables ---

function relLum(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// some pigments are fine as paint but too faint as text on their own ground
function readable(hex, ground, min = 4) {
  if (contrast(hex, ground) >= min) return hex;
  const lighten = relLum(ground) < 0.2;
  const hsl = rgbToHsl(hexToRgb(hex));
  for (let i = 0; i < 24; i++) {
    hsl.l = clamp(hsl.l + (lighten ? 3 : -3), 0, 100);
    const out = hslToHex(hsl);
    if (contrast(out, ground) >= min) return out;
  }
  return lighten ? '#ffffff' : '#000000';
}

export function cssVars(key) {
  const p = Object.hasOwn(PALETTES, key) ? PALETTES[key] : PALETTES.pigments;
  const g = p.ground;
  const vars = {
    bg: g, fg: readable(p.fg, g, 7), sel: p.sel,
    kw: readable(p.kw, g), fn: readable(p.fn, g), type: readable(p.type, g), str: readable(p.str, g),
    num: readable(p.num, g), com: readable(p.com, g, 3.6), id: readable(p.id, g, 5),
    op: readable(p.op, g), pun: readable(p.fg, g, 5),
  };
  return Object.entries(vars).map(([k, v]) => `--p-${k}:${v}`).join(';');
}
