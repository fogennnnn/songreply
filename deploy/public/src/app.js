/**
 * Songreply client: retrieval over the lyric model, fully in-browser.
 * No generation, no network after load. Type a sentence, get the best
 * matching lyric couplet back, copy it.
 */
import { replyFor } from "./reply.js";

let MODEL = null;

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_e) { ok = false; }
    ta.remove();
    return ok;
  }
}

async function load() {
  try {
    const res = await fetch("/model.json");
    if (!res.ok) throw new Error("model service returned " + res.status);
    MODEL = await res.json();
    document.getElementById("foot").textContent =
      `Retrieval over ${MODEL.meta.lines} lyric lines from ${MODEL.meta.songs} public-domain songs. ` +
      `No generation, no network after load - the reply always exists verbatim in the songs. ` +
      `Choruses and familiar songs rank higher.`;
  } catch (e) {
    document.getElementById("foot").textContent = "The model could not load. Serve this folder over http (npm run demo) and refresh.";
  }
}

async function go() {
  if (!MODEL) return;
  const prompt = document.getElementById("prompt").value;
  if (!prompt.trim()) return;
  const r = replyFor(prompt, MODEL);
  document.getElementById("lyric").textContent = r.lines.join("\n");
  document.getElementById("src").textContent = `- ${r.song} (${r.note})`;
  document.getElementById("match").textContent = r.fallback
    ? "no strong match - a classic instead"
    : `matched ${r.hit.length} word${r.hit.length === 1 ? "" : "s"}: ${r.hit.join(", ")}`;
  document.getElementById("card").classList.add("show");
  document.getElementById("copied").classList.remove("show");
  document.getElementById("copy").onclick = async () => {
    const ok = await copyText(r.lines.join("\n"));
    if (ok) document.getElementById("copied").classList.add("show");
  };
}

document.getElementById("go").onclick = () => go();
document.getElementById("prompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter") go();
});

load();
