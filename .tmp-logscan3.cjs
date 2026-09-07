const fs = require("fs");
const d = fs.readFileSync("C:/Users/Deighton/AppData/Local/Temp/b3-dec.txt", "utf8");
const L = d.split("\n");
console.log("lines:", L.length);
const markers = [];
L.forEach((l, i) => {
  if (/What went wrong|BUILD FAILED|exited with non-zero code|FAILURE:/.test(l)) markers.push(i);
});
console.log("markers:", JSON.stringify(markers));
const bundleStart = L.findIndex((l) => l.includes("createBundleReleaseJsAndAssets"));
console.log("bundle task line:", bundleStart);
const seen = new Set();
let printed = 0;
const from = bundleStart >= 0 ? bundleStart : 0;
for (let i = from; i < L.length && printed < 14; i++) {
  if (!/error|unable to resolve|cannot|failed|not found/i.test(L[i])) continue;
  let o = null;
  try { o = JSON.parse(L[i]); } catch {}
  const msg = o && o.msg ? o.msg : L[i];
  const key = msg.slice(0, 120);
  if (seen.has(key)) continue;
  seen.add(key);
  console.log("---");
  console.log(msg.replace(/\s+/g, " ").slice(0, 600));
  printed += 1;
}
