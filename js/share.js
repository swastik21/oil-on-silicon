// A painting travels in the URL hash, so a link reopens exactly that painting:
//   #p=z<base64url of deflated JSON>    (j instead of z if the browser can't deflate)
// Nothing is sent to a server; GitHub Pages never even sees the hash.

const toBase64Url = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, Transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(new Transform('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function linkTo(painting) {
  const json = new TextEncoder().encode(JSON.stringify({
    c: painting.code, p: painting.palette, m: painting.mode, t: painting.title, s: painting.sign,
  }));
  const data = 'CompressionStream' in window
    ? 'z' + toBase64Url(await pipe(json, CompressionStream))
    : 'j' + toBase64Url(json);
  return `${location.origin}${location.pathname}#p=${data}`;
}

// returns null for anything that isn't a well-formed painting link
export async function paintingInLink(hash = location.hash) {
  const m = hash.match(/^#p=([zj])([\w-]+)$/);
  if (!m) return null;
  try {
    let bytes = fromBase64Url(m[2]);
    if (m[1] === 'z') bytes = await pipe(bytes, DecompressionStream);
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof p.c !== 'string') return null;
    return {
      code: p.c,
      palette: String(p.p),
      mode: String(p.m),
      title: String(p.t ?? 'Untitled').slice(0, 60),
      sign: String(p.s ?? '').slice(0, 40),
    };
  } catch {
    return null;
  }
}
