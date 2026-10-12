import { Pool } from "pg";
import { env } from "@/config/env";

/**
 * Shared PostgreSQL connection pool.
 *
 * Reused by Prisma (driver adapter) and the express-session store so a single
 * serverless instance only opens a handful of connections. Keep `max` low:
 * on Vercel each concurrent function instance has its own pool, so the total
 * connections grow with load. Pair this with a pooled connection string
 * (e.g. Neon / PgBouncer) in serverless environments.
 */
export const dbPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 3,
});
