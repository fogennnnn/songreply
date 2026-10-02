/**
 * Normalize bulk public-domain lyric downloads into a clean song corpus.
 * Run: node scripts/normalize.mjs  (reads data/raw/*, writes data/corpus-bulk.json)
 * Per-source handling: Gutenberg front matter is skipped via content anchors,
 * archive.org pages are reduced to their <pre> book text, openhymnal is parsed
 * by hymn headings. Chorus/refrain labels and 3x-repeated lines are flagged.
 * Title blocklist + line filters reject front matter, letters, nav chrome.
 * Zero dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(root, "data", "raw");

function decodeEntities(t) {
  return t
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(t) {
  return decodeEntities(t)
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");
}

function stripGutenberg(t) {
  const start = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG/i);
  const end = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (start >= 0 && end > start) return t.slice(start, end);
  if (start >= 0) return t.slice(start);
  return t;
}

function extractPre(t) {
  const a = t.search(/<pre[\s>]/i);
  const b = t.toLowerCase().lastIndexOf("</pre>");
  if (a >= 0 && b > a) return stripHtml(t.slice(a, b));
  return stripHtml(t);
}

function cleanLine(s) {
  return s.replace(/\s+/g, " ").trim();
}

const TITLE_BLOCK = [
  /foreword/i, /introduction/i, /preface/i, /\bcontents\b/i, /dedication/i,
  /produced by/i, /project team/i, /dear (mr|mrs|ms|madam|sir)\b/i,
  /theodore roosevelt/i, /illustrat/i, /transcriber/i, /proofread/i,
  /free audio/i, /cylinder recording/i, /technology and science/i,
  /public affairs/i, /mobile site/i, /new hymns/i, /raw zip/i,
  /visitation/i, /^module\b/i, /yogh character/i, /footnotes? (have|has) been/i,
  /^https?:\/\//i, /^www\./i, /gutenberg/i, /archive\.org/i, /open ?hymnal/i,
  /all rights/i, /copyright/i, /\@/,
];

const TITLE_BLOCK2 = [
  /collectors? note/i, /london\s*\./i, /smithsonian/i, /press,/i, /library/i,
  /windlass|capstan|halliard|fore-sheet|pumping/i, /george routledge/i,
  /deming/i, /librarian/i, /carnegie/i, /english and scottish/i,
  /cowboy songs$/i, /shanty book$/i, /dear mr/i, /strconv/i,
  /printed in the/i, /barrett wendell/i, /walter runciman/i, /robin davisson/i,
  /united states of america/i, /shanty:$/i, /\bson?s:$/i, /slave songs of the/i,
  /^[A-Z]\.[A-Z]\.([A-Z]\.)?\s*$/,
];

function blockedTitle(t) {
  return TITLE_BLOCK.some((re) => re.test(t)) || TITLE_BLOCK2.some((re) => re.test(t));
}

function isTitleLike(line) {
  if (line.length === 0 || line.length > 70) return false;
  const ltrs = line.replace(/[^A-Za-z]/g, "");
  if (ltrs.length / line.length < 0.5) return false;
  const words = line.split(/\s+/);
  if (words.length > 10 || words.length === 0) return false;
  if (/^(song|hymn|carol|shanty|ballad)\b/i.test(line)) return true;
  if (/^\s*(\d+|[IVXLCDM]+)[\.\)]\s+\S/.test(line)) return true;
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  const caps = words.filter((w) => /^[A-Z][a-z]/.test(w)).length;
  if (words.length >= 2 && caps / words.length >= 0.6) return true;
  return false;
}

function isChorusMark(line) {
  return /^(chorus|refrain|burden|cho\.?)\s*[:.\-]?\s*$/i.test(line);
}

function normKey(line) {
  return line.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function finalizeSong(song) {
  if (song.lines.length < 4) return null;
  if (blockedTitle(song.title)) return null;
  const avgLen = song.lines.reduce((n, l) => n + l.t.length, 0) / song.lines.length;
  if (avgLen > 95) return null;
  const longShare = song.lines.filter((l) => l.t.length > 80).length / song.lines.length;
  if (longShare > 0.5) return null;
  const freq = Object.create(null);
  for (const ln of song.lines) {
    const k = normKey(ln.t);
    if (k) freq[k] = (freq[k] ?? 0) + 1;
  }
  for (const ln of song.lines) {
    if ((freq[normKey(ln.t)] ?? 0) >= 3) ln.c = 1;
  }
  const seen = new Set();
  song.lines = song.lines.filter((ln) => {
    const k = normKey(ln.t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return song.lines.length >= 4 ? song : null;
}

function pushLine(song, line, chorus) {
  if (!line || line.length > 140 || !/[a-z]/.test(line)) return;
  if (/^\d+\s+[A-Za-z]/.test(line)) return;
  if (/^https?:\/\//.test(line) || line.includes("</a>") || line.includes("<a ")) return;
  const letters = line.replace(/[^A-Za-z]/g, "").length;
  if (letters / line.length < 0.65) return;
  song.lines.push({ t: line, c: chorus ? 1 : 0 });
}

function parseGeneric(name, text) {
  const songs = [];
  let cur = null;
  let chorusMode = false;
  const flush = () => {
    if (cur) {
      const done = finalizeSong(cur);
      if (done) songs.push(done);
    }
    cur = null;
  };
  for (const line of text.split("\n").map(cleanLine)) {
    if (line === "") {
      chorusMode = false;
      continue;
    }
    if (isChorusMark(line)) {
      chorusMode = true;
      continue;
    }
    if (isTitleLike(line) && (!cur || cur.lines.length >= 2)) {
      flush();
      cur = { title: line.replace(/^\s*(\d+|[IVXLCDM]+)[\.\)]\s+/, "").replace(/\s+\d+\s*$/, ""), source: name, lines: [] };
      chorusMode = false;
      continue;
    }
    if (!cur) continue;
    if (cur.lines.length >= 80) {
      flush();
      continue;
    }
    pushLine(cur, line, chorusMode);
  }
  flush();
  return songs;
}

function parseHymns(name, html) {
  const songs = [];
  const parts = html.split(/<h3[^>]*>/i);
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const endTitle = seg.search(/<\/h3>/i);
    if (endTitle < 0) continue;
    const title = cleanLine(stripHtml(seg.slice(0, endTitle)));
    if (!title || blockedTitle(title)) continue;
    const body = stripHtml(seg.slice(endTitle));
    const verses = body.split(/^\s*\d+\.\s*/m).slice(1);
    const lines = [];
    for (const v of verses.slice(0, 8)) {
      for (const ln of v.split("\n").map(cleanLine)) {
        if (!ln || ln.length > 140 || !/[a-z]/.test(ln)) continue;
        if (/^(chorus|refrain)/i.test(ln)) {
          lines.push({ mark: true });
          continue;
        }
        lines.push({ t: ln, c: 0 });
      }
    }
    const flat = [];
    let chorusNext = false;
    for (const ln of lines) {
      if (ln.mark) {
        chorusNext = true;
        continue;
      }
      flat.push({ t: ln.t, c: chorusNext ? 1 : 0 });
      chorusNext = false;
    }
    const song = { title, source: name, lines: flat.slice(0, 60) };
    const done = finalizeSong(song);
    if (done) songs.push(done);
  }
  return songs;
}

const SPECS = [
  { file: "cowboy-1910.txt", source: "Cowboy songs, frontier ballads (Lomax 1910, PD)", cap: 200, kind: "txt" },
  { file: "shanties-1921.txt", source: "The Shanty Book (Terry 1921, PD)", cap: 100, kind: "txt" },
  { file: "spirituals-1867.txt", source: "Slave Songs of the United States (1867, PD)", cap: 200, kind: "pre" },
  { file: "ballads-1723.txt", source: "English ballads, 1723-25 collection (PD)", cap: 200, kind: "txt" },
  { file: "child-vol1.txt", source: "Child Ballads vol. I (1857-58, PD)", cap: 100, kind: "txt" },
  { file: "carols-1871.txt", source: "Christmas Carols New and Old (1871, PD)", cap: 150, kind: "pre" },
  { file: "nursery-19c.txt", source: "Mother Goose nursery rhymes, 19th c. (PD)", cap: 300, kind: "txt" },
  { file: "hymns-openhymnal.html", source: "OpenHymnal (pre-1930 hymns, PD)", cap: 250, kind: "hymns" },
];

const all = [];
for (const spec of SPECS) {
  const p = path.join(rawDir, spec.file);
  if (!fs.existsSync(p)) {
    console.log(`skip ${spec.file}: missing`);
    continue;
  }
  const raw = fs.readFileSync(p, "utf8");
  let songs;
  if (spec.kind === "hymns") {
    songs = parseHymns(spec.file, raw).slice(0, spec.cap);
  } else {
    let text = stripGutenberg(raw);
    if (spec.kind === "pre") text = extractPre(text);
    songs = parseGeneric(spec.file, text).slice(0, spec.cap);
  }
  for (const s of songs) s.source = spec.source;
  const chorusLines = songs.reduce((n, s) => n + s.lines.filter((l) => l.c === 1).length, 0);
  const totalLines = songs.reduce((n, s) => n + s.lines.length, 0);
  console.log(`${spec.file}: ${songs.length} songs, ${totalLines} lines, ${chorusLines} chorus-flagged`);
  all.push(...songs);
}

console.log(`TOTAL: ${all.length} bulk songs`);
fs.writeFileSync(path.join(root, "data", "corpus-bulk.json"), JSON.stringify({ songs: all }, null, 1));
console.log("wrote data/corpus-bulk.json");
