import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnv(name) {
  const raw = readFileSync(path.join(root, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (key !== name) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

const directUrl = readEnv("DIRECT_URL") ?? readEnv("DATABASE_URL");
if (!directUrl) {
  console.error("Set DIRECT_URL (Neon direct host) or DATABASE_URL in .env");
  process.exit(1);
}

const lockScript = path.join(root, "scripts", "release-prisma-migrate-lock.sql");

try {
  execSync(`npx prisma db execute --file "${lockScript}" --url "${directUrl}"`, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: directUrl },
  });
} catch {
  console.warn("Advisory lock release skipped or failed (continuing to migrate)…");
}

execSync("npx prisma migrate deploy", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
