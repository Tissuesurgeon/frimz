import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import postgres from "postgres";
import { postgresOptions } from "./postgres-options";

function loadEnvFile() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = postgres(url, postgresOptions(url, 1));
  await sql`create table if not exists schema_migrations (
    id text primary key,
    applied_at timestamptz not null default now()
  )`;
  const dir = path.join(process.cwd(), "db/migrations");
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const existing = await sql`select id from schema_migrations where id = ${file}`;
    if (existing.length > 0) continue;
    const body = readFileSync(path.join(dir, file), "utf8");
    await sql.unsafe(body);
    await sql`insert into schema_migrations (id) values (${file})`;
    console.log(`applied ${file}`);
  }
  await sql.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exit(1);
});
