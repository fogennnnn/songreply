/**
 * Lyric-reply scoring: pure functions over the model, no DOM.
 * Score = TF-IDF overlap, boosted for chorus lines (x1.5) and the familiar
 * curated songs (x1.2), so replies favour the parts of songs people know.
 * Shared by the browser app and the node verification script.
 */

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 0);
}

function compareKey(a, b) {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) return a[k] - b[k];
  }
  return 0;
}

function makeCouplet(model, i) {
  const ln = model.lines[i];
  const song = model.songs[ln.s];
  const next = model.lines[i + 1];
  const second = next && next.s === ln.s ? next.text : null;
  return { lines: second ? [ln.text, second] : [ln.text], song: song.title, note: song.note };
}

function famousLine(model, titlePart, linePart) {
  const si = model.songs.findIndex((s) => s.title.toLowerCase().includes(titlePart.toLowerCase()));
  if (si < 0) return -1;
  return model.lines.findIndex(
    (l) => l.s === si && l.text.toLowerCase().includes(linePart.toLowerCase())
  );
}

const FAMOUS = [
  ["Scarborough", "Parsley"],
  ["Amazing Grace", "Amazing grace"],
  ["Amazing Grace", "I once was lost"],
  ["Clementine", "Oh my darling"],
  ["Ball Game", "Take me out"],
  ["Saints", "saints go marching"],
  ["Rising Sun", "house in New Orleans"],
  ["Susanna", "banjo on my knee"],
  ["Auld Lang Syne", "cup of kindness"],
  ["Greensleeves", "Greensleeves was all my joy"],
  ["Shenandoah", "Oh Shenandoah"],
  ["Simple Gifts", "gift to be simple"],
  ["Home on the Range", "deer and the antelope"],
  ["Railroad", "working on the railroad"],
  ["Yankee Doodle", "went to town"],
  ["Red River", "Red River Valley"],
  ["Riverside", "lay down my sword"],
  ["Take Me Out", "root, root, root"],
];

function famousSet(model) {
  if (model._famous) return model._famous;
  const set = new Set();
  for (const [t, l] of FAMOUS) {
    const si = model.songs.findIndex((s) => s.title.toLowerCase().includes(t.toLowerCase()));
    if (si < 0) continue;
    model.lines.forEach((ln, i) => {
      if (ln.s === si && ln.text.toLowerCase().includes(l.toLowerCase())) set.add(i);
    });
  }
  model._famous = set;
  return set;
}

function fallback(model, prompt) {
  const start = (prompt ?? "").trim().length % FAMOUS.length;
  for (let k = 0; k < FAMOUS.length; k++) {
    const [t, l] = FAMOUS[(start + k) % FAMOUS.length];
    const li = famousLine(model, t, l);
    if (li >= 0) return { ...makeCouplet(model, li), hit: [], fallback: true };
  }
  const ci = model.lines.findIndex((l) => l.c === 1);
  const li = ci >= 0 ? ci : 0;
  return { ...makeCouplet(model, li), hit: [], fallback: true };
}

export function replyFor(prompt, model) {
  const terms = tokenize(prompt).filter((t) => (model.idf[t] ?? 0) > 0);
  const uniq = [...new Set(terms)];
  if (uniq.length === 0) return fallback(model, prompt);
  let best = null;
  const fam = famousSet(model);
  model.lines.forEach((ln, i) => {
    const set = new Set(ln.terms);
    const hit = uniq.filter((t) => set.has(t));
    if (hit.length === 0) return;
    const boost = (ln.c === 1 ? 1.5 : 1) * (ln.f === 1 ? 1.2 : 1) * (fam.has(i) ? 2 : 1);
    const score = hit.reduce((s, t) => s + model.idf[t], 0) * boost;
    const key = [score, hit.length, -ln.text.length, -i];
    if (!best || compareKey(key, best.key) > 0) best = { key, i, hit };
  });
  if (!best) return fallback(model, prompt);
  return { ...makeCouplet(model, best.i), hit: best.hit, fallback: false };
}
