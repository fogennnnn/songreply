# Songreply — answer in lyrics (demonstration)

Type any sentence. Get back a reply made of famous old song lyrics, ready to
copy and paste.

A tiny retrieval model (word-overlap scoring over 205 lyric lines from 16
public-domain folk songs) runs entirely in your browser. No generation, no
network after load: every reply exists verbatim in the songs. All lyrics are
public-domain traditional songs (provenance notes ship in the app); famously
copyrighted songs were deliberately left out.

## Quickstart (anyone, local, 2 minutes)

Prerequisite: Node.js 22+ and nothing else (zero npm dependencies).

```sh
git clone <this-repo> songreply
cd songreply
sh install.sh        # Windows: install.ps1 — checks Node, rebuilds the model, runs the checks
npm run demo         # browser: open http://localhost:8082/ and type a sentence
```

Rebuild the model any time with `npm run build` (prints songs, lines, terms).
