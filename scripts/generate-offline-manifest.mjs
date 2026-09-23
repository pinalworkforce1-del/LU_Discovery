import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.argv[2] || "dist";
const baseArg = process.argv[3] || "/";
const base = baseArg.endsWith("/") ? baseArg : baseArg + "/";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const all = await walk(root);
const rows = [];
let totalBytes = 0;
for (const file of all) {
  const rel = relative(root, file).split(sep).join("/");
  if (rel === "offline-manifest.json") continue;
  const info = await stat(file);
  totalBytes += info.size;
  rows.push({ path: "./" + rel, bytes: info.size });
}
rows.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  engine: "Level Up Offline Engine",
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  scope: base,
  totalBytes,
  files: rows,
};

await writeFile(join(root, "offline-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Offline manifest: ${rows.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB for ${base}`);
