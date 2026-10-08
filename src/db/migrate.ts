import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  // MIGRATION_DATABASE_URL (facoltativa): connessione diretta/session per le migrazioni, se il pooler desse problemi.
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL mancante");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const client = postgres(url, { max: 1, prepare: false, ssl: isLocal ? false : "require" });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("Migrazioni applicate.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
