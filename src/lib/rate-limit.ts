import { sql } from "drizzle-orm";
import { db } from "./db";
import { tooMany } from "./errors";

/**
 * Rate limiting su finestra fissa, salvato su Postgres: funziona anche su serverless
 * (dove la memoria non è condivisa tra le istanze). Lancia 429 se il limite è superato.
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const res = await db().execute<{ count: number }>(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count
  `);
  const count = Number((res as unknown as { count: number }[])[0]?.count ?? 1);
  if (count > limit) throw tooMany();
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
