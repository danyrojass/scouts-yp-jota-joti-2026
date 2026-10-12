import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { dbPool } from "@/lib/dbPool";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Driver adapter: Prisma talks to PostgreSQL through `pg` (shared pool) and a
 * WASM query compiler shipped with `@prisma/client`. This avoids shipping the
 * native Rust query engine binary, which is required for serverless hosts like
 * Vercel. `disposeExternalPool: false` keeps the shared pool alive across the
 * Prisma and express-session consumers.
 */
const adapter = new PrismaPg(dbPool, { disposeExternalPool: false });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
