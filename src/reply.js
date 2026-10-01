/**
 * Lyric-reply scoring: pure functions over the model, no DOM.
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

const CLASSICS = [25, 40, 64, 107, 198];

function fallback(model, prompt) {
  const i = CLASSICS[(prompt ?? "").trim().length % CLASSICS.length];
  return { ...makeCouplet(model, i), hit: [], fallback: true };
}

export function replyFor(prompt, model) {
  const terms = tokenize(prompt).filter((t) => (model.idf[t] ?? 0) > 0);
  const uniq = [...new Set(terms)];
  if (uniq.length === 0) return fallback(model, prompt);
  let best = null;
  model.lines.forEach((ln, i) => {
    const set = new Set(ln.terms);
    const hit = uniq.filter((t) => set.has(t));
    if (hit.length === 0) return;
    const score = hit.reduce((s, t) => s + model.idf[t], 0);
    const key = [score, hit.length, -ln.text.length, -i];
    if (!best || compareKey(key, best.key) > 0) best = { key, i, hit };
  });
  if (!best) return fallback(model, prompt);
  return { ...makeCouplet(model, best.i), hit: best.hit, fallback: false };
}
