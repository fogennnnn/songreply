// Stage the Cloudflare Worker deploy bundle for the songreply app.
// Copies the page + browser modules into deploy/public/ (model.json is
// already built there by `npm run build`). Run: node deploy/build.cjs
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pub = path.join(__dirname, "public");

function copy(srcRel, destRel) {
  const src = path.join(root, srcRel);
  const dest = path.join(pub, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

copy("index.html", "index.html");
for (const f of ["app.js", "reply.js"]) {
  copy(path.join("src", f), path.join("src", f));
}
copy(path.join("public", "model.json"), "model.json");

const missing = ["index.html", "src/app.js", "src/reply.js", "model.json"].filter(
  (f) => !fs.existsSync(path.join(pub, f))
);
if (missing.length > 0) {
  console.error("deploy bundle incomplete, missing: " + missing.join(", ") + " (run npm run build first)");
  process.exit(1);
}
console.log("songreply deploy bundle staged in deploy/public.");
