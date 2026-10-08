import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "./env";

type Db = ReturnType<typeof drizzle<typeof schema>>;
const globalForDb = globalThis as unknown as { __db?: Db };

function create(): Db {
  const url = env().DATABASE_URL;
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  // `prepare: false` è necessario con i pooler (es. Neon pooled / pgbouncer).
  const client = postgres(url, { max: 5, prepare: false, ssl: isLocal ? false : "require", idle_timeout: 20 });
  return drizzle(client, { schema });
}

export function db(): Db {
  if (!globalForDb.__db) globalForDb.__db = create();
  return globalForDb.__db;
}

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
