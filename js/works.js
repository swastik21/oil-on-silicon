// The collection. Notes use _underscores_ for titles of books and journals.

export const SELF_PORTRAIT = {
  title: 'Self-Portrait as a Developer',
  palette: 'pigments', mode: 'vortex', aspect: 4 / 5, sign: 'every dev',
  code: String.raw`// Self-portrait as a developer
const canvas = editor.newFile();

for (const idea of ideas) {
  canvas.write(idea);    // a keystroke is a brushstroke
  canvas.run();          // step back and squint
  canvas.refactor();     // add a second coat
}

git.commit("-m", "final_v2_really");  // sign the work`,
};

export const WORKS = [
  {
    id: 'euclid', year: 'c. 300 BCE', acc: '−300.1', after: 'Euclid',
    title: 'The Greatest Common Measure',
    artist: 'Euclid of Alexandria',
    school: 'Greek mathematician, active c. 300 BCE',
    date: 'c. 300 BCE',
    medium: 'Proposition VII.2, transcribed to Python',
    note: 'From Book VII of the _Elements_. More than two thousand years later it still runs every day, including inside the cryptography that secures the web.',
    palette: 'fresco', mode: 'field', frame: 'gilt', aspect: 4 / 5, sign: 'Euclid',
    code: String.raw`def gcd(a, b):
    while b:
        a, b = b, a % b
    return a`,
  },
  {
    id: 'lovelace', year: '1843', acc: '1843.1', after: 'Lovelace',
    title: 'Note G',
    artist: 'Ada Lovelace',
    school: 'English mathematician, 1815–1852',
    date: '1843',
    medium: 'Ink on paper, transcribed to JavaScript',
    note: 'Written for Charles Babbage’s Analytical Engine, a machine that was never built. Note G sets out, step by step, how the Engine would compute Bernoulli numbers. It is often called the first computer program.',
    palette: 'nocturne', mode: 'vortex', frame: 'gilt', aspect: 1, sign: 'A. A. L.',
    code: String.raw`// Note G, after Ada Lovelace: the Bernoulli numbers
function bernoulli(n) {
  const a = [];
  for (let m = 0; m <= n; m++) {
    a[m] = 1 / (m + 1);
    for (let j = m; j >= 1; j--) {
      a[j - 1] = j * (a[j - 1] - a[j]);
    }
  }
  return a[0];
}`,
  },
  {
    id: 'hoare', year: '1959', acc: '1959.1', after: 'Hoare',
    title: 'Quicksort',
    artist: 'Tony Hoare',
    school: 'British computer scientist',
    date: '1959',
    medium: 'Haskell on silicon',
    note: 'Hoare came up with it in 1959, as a visiting student in Moscow, to sort words for a machine translation project. In Haskell the code reads almost like the idea itself.',
    palette: 'midcentury', mode: 'cascade', frame: 'walnut', aspect: 5 / 4, sign: 'Hoare',
    code: String.raw`quicksort :: Ord a => [a] -> [a]
quicksort [] = []
quicksort (p:xs) = quicksort smaller ++ [p] ++ quicksort larger
  where
    smaller = [x | x <- xs, x < p]
    larger  = [x | x <- xs, x >= p]`,
  },
  {
    id: 'conway', year: '1970', acc: '1970.1', after: 'Conway',
    title: 'The Game of Life',
    artist: 'John Horton Conway',
    school: 'English mathematician, 1937–2020',
    date: '1970',
    medium: 'Counters on a board, transcribed to Python',
    note: 'Two rules on an endless grid, and no players. Martin Gardner introduced it in _Scientific American_ in October 1970. People are still discovering new creatures in it.',
    palette: 'phosphor', mode: 'mosaic', frame: 'float', aspect: 1, sign: 'Conway',
    code: String.raw`from collections import Counter

def step(alive):
    neighbours = Counter(
        (x + dx, y + dy)
        for x, y in alive
        for dx in (-1, 0, 1)
        for dy in (-1, 0, 1)
        if dx or dy
    )
    return {cell for cell, n in neighbours.items()
            if n == 3 or (n == 2 and cell in alive)}`,
  },
  {
    id: 'kr', year: '1978', acc: '1978.1', after: 'Kernighan & Ritchie',
    title: 'hello, world',
    artist: 'Brian Kernighan & Dennis Ritchie',
    school: 'Bell Labs, Murray Hill',
    date: '1978',
    medium: 'C on silicon',
    note: 'From _The C Programming Language_. Kernighan first wrote a version for a 1972 tutorial on the B language, and it has been the first program for millions of people since.',
    palette: 'press', mode: 'field', frame: 'mat', aspect: 4 / 5, sign: 'K & R',
    code: String.raw`#include <stdio.h>

main()
{
    printf("hello, world\n");
}`,
  },
  {
    id: 'quake', year: '1999', acc: '1999.1', after: 'an unknown master',
    title: 'Fast Inverse Square Root',
    artist: 'Artist unknown',
    school: 'Shipped in Quake III Arena by id Software',
    date: '1999',
    medium: 'C on silicon',
    note: 'It approximates 1/√x with one magic number and a single step of Newton’s method, a trick fast enough for 3D graphics in 1999. For years, nobody knew who wrote it.',
    palette: 'arena', mode: 'bloom', frame: 'metal', aspect: 16 / 10, sign: '',
    code: String.raw`float Q_rsqrt(float number)
{
    long i;
    float x2, y;
    const float threehalfs = 1.5F;

    x2 = number * 0.5F;
    y  = number;
    i  = * ( long * ) &y;
    i  = 0x5f3759df - ( i >> 1 );
    y  = * ( float * ) &i;
    y  = y * ( threehalfs - ( x2 * y * y ) );

    return y;
}`,
  },
];

export const SAMPLE = {
  title: 'Study in Blue',
  palette: 'pigments', mode: 'field',
  code: String.raw`// Untitled (Study in Blue), 2026
function paint(canvas, idea) {
  const colors = ["ultramarine", "ochre", "vermilion"];
  for (let i = 0; i < 42; i++) {
    canvas.stroke(colors[i % 3], idea.weight * i);
  }
  return canvas.sign("you");
}`,
};
