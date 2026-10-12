import { beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://ypacarai:ypacarai@127.0.0.1:5433/ypacarai_test?schema=public";

// Must be set before any module that reads the environment is imported.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = "test-secret-with-more-than-thirty-two-characters";
process.env.PUBLIC_BASE_URL = "https://evento.test";
process.env.CORS_ORIGINS = "https://evento.test";
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAMESITE = "lax";
process.env.SESSION_TTL_HOURS = "24";
process.env.LOGIN_MAX_ATTEMPTS = "1000";

/**
 * Wipes all tables once per test file, before the file's own fixtures are
 * created. Test files run sequentially (fileParallelism: false), so every file
 * starts from a clean database.
 */
async function wipeDb() {
  await prisma.$transaction([
    prisma.stationVisit.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.routeStop.deleteMany(),
    prisma.team.deleteMany(),
    prisma.station.deleteMany(),
    prisma.event.deleteMany(),
    prisma.user.deleteMany(),
    prisma.$executeRawUnsafe(`DELETE FROM "session"`),
  ]);
}

beforeAll(async () => {
  await wipeDb();
});