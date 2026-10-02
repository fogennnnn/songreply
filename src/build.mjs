// Build the lyric-reply model: curated 16 + bulk corpus, TF-IDF weights,
// chorus and familiarity boosts baked in as per-line multipliers.
// Run: npm run build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SONGS as CURATED } from "./corpus.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STOP = new Set(
  "a,an,am,and,are,as,at,be,been,being,but,by,can,could,do,does,did,for,from,had,has,have,he,her,his,i,in,is,it,its,me,my,not,of,on,or,she,should,so,that,the,their,they,this,to,we,were,will,would,with,you,your".split(",")
);

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function normKey(line) {
  return line.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

// songs: [{title, note, curated, lines:[{t, c}]} — c=1 marks chorus/famous lines
const songs = [];
for (const s of CURATED) {
  songs.push({ title: s.title, note: s.note, curated: true, lines: s.lines.map((t) => ({ t, c: 0 })) });
}
const bulk = JSON.parse(fs.readFileSync(path.join(root, "data", "corpus-bulk.json"), "utf8"));
for (const s of bulk.songs) {
  songs.push({ title: s.title, note: s.source, curated: false, lines: s.lines.map((l) => ({ t: l.t, c: l.c === 1 ? 1 : 0 })) });
}

// repetition post-pass on curated songs too (a line sung 3+ times is a chorus)
for (const s of songs) {
  const freq = Object.create(null);
  for (const ln of s.lines) {
    const k = normKey(ln.t);
    if (k) freq[k] = (freq[k] ?? 0) + 1;
  }
  for (const ln of s.lines) {
    if ((freq[normKey(ln.t)] ?? 0) >= 3) ln.c = 1;
  }
}

const flat = [];
for (let i = 0; i < songs.length; i++) {
  for (const ln of songs[i].lines) {
    flat.push({ s: i, text: ln.t, chorus: ln.c === 1, curated: songs[i].curated });
  }
}

const df = Object.create(null);
const counts = [];
for (const ln of flat) {
  const c = Object.create(null);
  for (const t of new Set(tokenize(ln.text))) {
    c[t] = (c[t] ?? 0) + 1;
    df[t] = (df[t] ?? 0) + 1;
  }
  counts.push(c);
}

const N = flat.length;
const idf = {};
for (const [t, d] of Object.entries(df)) {
  idf[t] = Math.log(N / d);
}

const model = {
  songs: songs.map((s) => ({ title: s.title, note: s.note })),
  lines: flat.map((ln, i) => ({ s: ln.s, text: ln.text, terms: Object.keys(counts[i]), c: ln.chorus ? 1 : 0, f: ln.curated ? 1 : 0 })),
  idf,
  meta: {
    songs: songs.length,
    lines: flat.length,
    vocab: Object.keys(idf).length,
    chorusLines: flat.filter((l) => l.chorus).length,
  },
};

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "model.json"), JSON.stringify(model));
const chorusPct = ((100 * model.meta.chorusLines) / model.meta.lines).toFixed(1);
console.log(`model built: ${model.meta.songs} songs, ${model.meta.lines} lines, ${model.meta.vocab} terms, ${model.meta.chorusLines} chorus-flagged (${chorusPct}%).`);
