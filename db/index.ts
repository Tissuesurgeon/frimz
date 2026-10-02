import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { postgresOptions } from "./postgres-options";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  pg?: ReturnType<typeof postgres>;
  db?: Database;
  dbGeneration?: number;
};

const dbGeneration = 3;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForDb.db || globalForDb.dbGeneration !== dbGeneration) {
    void globalForDb.pg?.end({ timeout: 1 });
    globalForDb.pg = postgres(url, postgresOptions(url, 10));
    globalForDb.db = drizzle(globalForDb.pg, { schema });
    globalForDb.dbGeneration = dbGeneration;
  }
  return globalForDb.db;
}
