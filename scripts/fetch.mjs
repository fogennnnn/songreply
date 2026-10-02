/**
 * Download bulk public-domain lyric sources (single files, no scraping).
 * Run: node scripts/fetch.mjs  (writes data/raw/*.txt + manifest)
 * Sources from research: Gutenberg pre-1930 songbooks, archive.org scans,
 * openhymnal all-lyrics page. Zero dependencies (global fetch).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = path.join(root, "data", "raw");
fs.mkdirSync(raw, { recursive: true });

const SOURCES = [
  { name: "cowboy-1910", url: "https://www.gutenberg.org/cache/epub/21300/pg21300.txt", kind: "folk/cowboy" },
  { name: "shanties-1921", url: "https://www.gutenberg.org/cache/epub/20774/pg20774.txt", kind: "sea shanties" },
  { name: "spirituals-1867", url: "https://archive.org/stream/slavesongsofunit00alle/slavesongsofunit00alle_djvu.txt", kind: "spirituals" },
  { name: "ballads-1723", url: "https://www.gutenberg.org/cache/epub/11236/pg11236.txt", kind: "ballads" },
  { name: "child-vol1", url: "https://www.gutenberg.org/cache/epub/37031/pg37031.txt", kind: "child ballads" },
  { name: "carols-1871", url: "https://archive.org/stream/carolsn00bram/carolsn00bram_djvu.txt", kind: "carols" },
  { name: "nursery-19c", url: "https://www.gutenberg.org/cache/epub/39784/pg39784.txt", kind: "nursery rhymes" },
  { name: "hymns-openhymnal", url: "http://openhymnal.org/alllyrics.html", kind: "hymns" },
];

const manifest = [];
for (const s of SOURCES) {
  try {
    const res = await fetch(s.url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const ext = s.url.endsWith(".html") ? "html" : "txt";
    const file = `${s.name}.${ext}`;
    fs.writeFileSync(path.join(raw, file), text);
    manifest.push({ ...s, file, bytes: text.length, ok: true });
    console.log(`ok ${s.name}: ${text.length} chars`);
  } catch (e) {
    manifest.push({ ...s, ok: false, error: String(e?.message ?? e) });
    console.log(`FAIL ${s.name}: ${e?.message ?? e}`);
  }
}
fs.writeFileSync(path.join(raw, "manifest.json"), JSON.stringify(manifest, null, 2));
