import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const target = args[0];
const database = args[1] ?? "michelin-guide";
if (!["--local", "--remote"].includes(target) || args.length > 2 || database.startsWith("--")) {
  throw new Error("Usage: bun scripts/import-data.ts --local|--remote [database-name]");
}
const wrangler = path.join(root, "node_modules", ".bin", "wrangler");
const files = readdirSync(path.join(root, ".data")).filter((file) => file.endsWith(".sql")).sort();
if (!files.length) throw new Error("Run `bun run data:prepare` first.");

for (const file of files) {
  console.log(`Importing ${file} (${target})`);
  const result = Bun.spawnSync({
    cmd: [wrangler, "d1", "execute", database, target, "--file", path.join(root, ".data", file)],
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) throw new Error(`Import failed for ${file}`);
}
