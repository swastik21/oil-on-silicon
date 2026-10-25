// Seeded randomness. Every painting is a pure function of its code,
// so nothing here is allowed to touch Math.random.

export function hash(str) {
  // FNV-1a, then a murmur3 finaliser so that similar strings
  // (one character apart) still land far apart
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

// mulberry32
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// cheap bell curve: sum of four uniforms, scaled to sd ≈ 1
export const gauss = (r) => (r() + r() + r() + r() - 2) * 1.7320508;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Perlin-style gradient noise with three octaves
export function makeNoise(r) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const u = fade(xf), v = fade(yf);
    const d00 = gx[aa] * xf + gy[aa] * yf;
    const d10 = gx[ba] * (xf - 1) + gy[ba] * yf;
    const d01 = gx[ab] * xf + gy[ab] * (yf - 1);
    const d11 = gx[bb] * (xf - 1) + gy[bb] * (yf - 1);
    const top = d00 + u * (d10 - d00);
    const bottom = d01 + u * (d11 - d01);
    return (top + v * (bottom - top)) * 1.4142;
  }

  return (x, y) =>
    noise(x, y) * 0.62 +
    noise(x * 2.03 + 17.1, y * 2.03 - 9.2) * 0.27 +
    noise(x * 4.11 - 3.3, y * 4.11 + 5.7) * 0.11;
}
