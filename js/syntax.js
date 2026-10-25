// A forgiving highlighter. It doesn't need to be right about every
// language, only consistent: the painter uses the token kinds as pigments.
//
// kinds: kw fn type str id num op com pun, plus ws and nl
//
// TODO: Haskell names like x' and Rust lifetimes like 'a start a "string" here

const KEYWORDS = new Set(`abstract and as assert async await begin break case catch chan class const
  continue data def default defer del delete deriving do echo elif else elsif end enum except export
  extends extern false final finally fn for from fun func function global go goto guard if impl
  implements import in instance instanceof interface is lambda let loop match mod module mut new nil
  nonlocal not null of or override package pass private protected pub public raise range register
  return select self sizeof static struct super switch then this throw throws trait true try typedef
  typeof undefined union unless unsafe until use using val var volatile when where while with yield
  None True False NULL SELECT FROM WHERE INSERT UPDATE DELETE CREATE TABLE JOIN GROUP ORDER LIMIT
  INTO VALUES`.split(/\s+/));

const TYPES = new Set(`int long float double char bool boolean string byte short unsigned signed
  size_t u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 usize isize str number any never unknown void
  auto`.split(/\s+/));

const PREPROCESSOR = /^#\s*(include|define|ifdef|ifndef|if|endif|else|elif|pragma|undef|import|error)\b/;
const DEFINES_FN = new Set(['def', 'function', 'fn', 'func', 'fun']);
const ID_START = /[A-Za-z_$À-￿]/;
const ID_PART = /[A-Za-z0-9_$À-￿]/;
const OP = /[+\-*/%=<>!&|^~?:@]/;

export function tokenize(src) {
  const out = [];
  const n = src.length;
  let i = 0, line = 0, col = 0, prev = null;

  const push = (text, kind) => {
    const tok = { text, kind, line, col };
    out.push(tok);
    if (kind !== 'ws') prev = tok;
    for (const ch of text) col += ch === '\t' ? 4 - (col % 4) : 1;
  };
  const newline = () => {
    out.push({ text: '\n', kind: 'nl', line, col });
    line++;
    col = 0;
  };
  // block comments and template strings can span lines
  const pushLines = (text, kind) => {
    text.split('\n').forEach((part, idx) => {
      if (idx > 0) newline();
      part = part.replace(/\r/g, '');
      if (part) push(part, kind);
    });
  };
  // is the previous token something you could subtract from? (x-- vs -- comment)
  const afterValue = () => prev && prev.line === line && /[\w)\]]$/.test(prev.text);

  while (i < n) {
    const c = src[i];

    if (c === '\r') { i++; continue; }
    if (c === '\n') { newline(); i++; continue; }

    if (c === ' ' || c === '\t') {
      let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) j++;
      push(src.slice(i, j), 'ws');
      i = j;
      continue;
    }

    if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? n : j + 2;
      pushLines(src.slice(i, j), 'com');
      i = j;
      continue;
    }

    if (c === '#' && PREPROCESSOR.test(src.slice(i, i + 14))) {
      const word = src.slice(i).match(/^#\s*[a-z]+/)[0];
      push(word, 'kw');
      i += word.length;
      continue;
    }

    const dashComment = c === '-' && src[i + 1] === '-' &&
      (src[i + 2] === ' ' || src[i + 2] === '\n' || i + 2 >= n) && !afterValue();
    if ((c === '/' && src[i + 1] === '/') || c === '#' || dashComment) {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      push(src.slice(i, j).replace(/\r$/, ''), 'com');
      i = j;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const triple = c !== '`' && src.startsWith(c + c + c, i);
      if (triple || c === '`') {
        const close = triple ? c + c + c : '`';
        let j = i + close.length;
        while (j < n && !src.startsWith(close, j)) {
          if (src[j] === '\\') j++;
          j++;
        }
        j = Math.min(n, j + close.length);
        pushLines(src.slice(i, j), 'str');
        i = j;
        continue;
      }
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        j++;
      }
      if (src[j] === c) j++;
      push(src.slice(i, j), 'str');
      i = j;
      continue;
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || '') && !afterValue())) {
      const m = src.slice(i, i + 64).match(/^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d*\.?\d[\d_]*(?:[eE][+-]?\d+)?)[a-zA-Z]*/);
      const num = m ? m[0] : c;
      push(num, 'num');
      i += num.length;
      continue;
    }

    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < n && ID_PART.test(src[j])) j++;
      if (src[j] === '!' && src[j + 1] === '(') j++; // rust macros: println!(...)
      const word = src.slice(i, j);
      let k = j;
      while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;

      let kind = 'id';
      if (KEYWORDS.has(word)) kind = 'kw';
      else if (TYPES.has(word)) kind = 'type';
      else if (prev && DEFINES_FN.has(prev.text)) kind = 'fn';
      else if (src[k] === '(' || word.endsWith('!')) kind = 'fn';
      else if (/^[A-Z][A-Z0-9_]{2,}$/.test(word)) kind = 'num'; // CONSTANTS paint like numbers
      else if (/^[A-Z]/.test(word)) kind = 'type';

      push(word, kind);
      i = j;
      continue;
    }

    if (OP.test(c)) {
      let j = i + 1;
      while (j < n && j - i < 3 && OP.test(src[j]) && !(src[j] === '/' && (src[j + 1] === '/' || src[j + 1] === '*'))) j++;
      push(src.slice(i, j), 'op');
      i = j;
      continue;
    }

    push(c, 'pun');
    i++;
  }
  return out;
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// one string of HTML per source line
export function highlight(src) {
  const lines = [''];
  for (const t of tokenize(src)) {
    if (t.kind === 'nl') {
      lines.push('');
      continue;
    }
    const text = escapeHtml(t.text);
    lines[lines.length - 1] += t.kind === 'ws' ? text : `<span class="t-${t.kind}">${text}</span>`;
  }
  return lines;
}

// only used for the "medium" line on the label, so a good guess is enough
export function guessLanguage(code) {
  if (/^\s*#\s*include\s*[<"]/m.test(code)) return 'C';
  if (/\bfn\s+\w+\s*\(|\blet\s+mut\b|println!\(/.test(code)) return 'Rust';
  if (/\bfunc\s+\w+\s*\(/.test(code) && /(:=|\bpackage\s+\w+)/.test(code)) return 'Go';
  if (/<\?php/.test(code)) return 'PHP';
  if (/^\s*def\s+\w+.*\)\s*(->\s*[\w[\], ]+)?:\s*$/m.test(code)) return 'Python';
  if (/^\s*(from\s+\w+\s+import|import\s+\w+)\s*$/m.test(code) && /:\s*$/m.test(code)) return 'Python';
  if (/^\s*def\s+\w+/m.test(code) && /^\s*end\s*$/m.test(code)) return 'Ruby';
  if (/::\s*[A-Z([]/.test(code) && !/[{};]/.test(code)) return 'Haskell';
  if (/\b(public|private|protected)\s+(static\s+)?(final\s+)?(class|void|int|String)\b/.test(code)) return 'Java';
  if (/\binterface\s+\w+\s*\{|:\s*(string|number|boolean)\b/.test(code)) return 'TypeScript';
  if (/\b(function|const|let|var)\b|=>/.test(code)) return 'JavaScript';
  if (/^\s*(SELECT|INSERT|UPDATE|CREATE|WITH)\b/im.test(code)) return 'SQL';
  if (/^\s*<[a-z!][\s\S]*>/i.test(code)) return 'HTML';
  if (/^\s*(fun|val)\s/m.test(code)) return 'Kotlin';
  if (/^\s*(def|class|import)\b/m.test(code)) return 'Python';
  return 'Code';
}
