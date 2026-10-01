// Build the lyric-reply model: tokenize the corpus, compute TF-IDF weights,
// emit model.json. The "training" is an index build - retrieval, not
// generation. Run: npm run build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SONGS } from "./corpus.js";

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

const lines = [];
for (let s = 0; s < SONGS.length; s++) {
  for (const text of SONGS[s].lines) {
    lines.push({ s, text });
  }
}

const df = Object.create(null);
const counts = [];
for (const ln of lines) {
  const c = Object.create(null);
  for (const t of new Set(tokenize(ln.text))) {
    c[t] = (c[t] ?? 0) + 1;
    df[t] = (df[t] ?? 0) + 1;
  }
  counts.push(c);
}

const N = lines.length;
const idf = {};
for (const [t, d] of Object.entries(df)) {
  idf[t] = Math.log(N / d);
}

const model = {
  songs: SONGS.map((s) => ({ title: s.title, note: s.note })),
  lines: lines.map((ln, i) => ({ s: ln.s, text: ln.text, terms: Object.keys(counts[i]) })),
  idf,
  meta: { songs: SONGS.length, lines: lines.length, vocab: Object.keys(idf).length },
};

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "model.json"), JSON.stringify(model));
console.log(`model built: ${model.meta.songs} songs, ${model.meta.lines} lines, ${model.meta.vocab} terms.`);
