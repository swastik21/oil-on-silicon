import { MAX_CHARS } from './painter.js';

// A painting travels in the URL hash, so a link reopens exactly that painting:
//   #p=z<base64url of deflated JSON>    (j instead of z if the browser can't deflate)
// Nothing is sent to a server; GitHub Pages never even sees the hash.

// Links come from strangers, so both the link and what it inflates to are capped.
// Real links are far smaller: the code is cut to MAX_CHARS before it's packed.
const MAX_LINK = 80_000;
const MAX_JSON = 64 * 1024;

const toBase64Url = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// stops reading as soon as the output passes `limit`, so a tiny link can't
// expand into gigabytes
async function inflate(bytes, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('painting link too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export async function linkTo(painting) {
  const json = new TextEncoder().encode(JSON.stringify({
    c: painting.code.slice(0, MAX_CHARS), p: painting.palette, m: painting.mode, t: painting.title, s: painting.sign,
  }));
  const data = 'CompressionStream' in window ? 'z' + toBase64Url(await deflate(json)) : 'j' + toBase64Url(json);
  return `${location.origin}${location.pathname}#p=${data}`;
}

// returns null for anything that isn't a well-formed painting link
export async function paintingInLink(hash = location.hash) {
  if (hash.length > MAX_LINK) return null;
  const m = hash.match(/^#p=([zj])([\w-]+)$/);
  if (!m) return null;
  try {
    let bytes = fromBase64Url(m[2]);
    if (m[1] === 'z') bytes = await inflate(bytes, MAX_JSON);
    else if (bytes.length > MAX_JSON) return null;
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof p.c !== 'string') return null;
    return {
      code: p.c.slice(0, MAX_CHARS),
      palette: String(p.p),
      mode: String(p.m),
      title: String(p.t ?? 'Untitled').slice(0, 60),
      sign: String(p.s ?? '').slice(0, 40),
    };
  } catch {
    return null;
  }
}
