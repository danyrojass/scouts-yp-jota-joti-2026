import { beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Wipes all tables once per test file, before the file's own fixtures are
 * created. Test files run sequentially (fileParallelism: false), so every file
 * starts from a clean database.
 *
 * The test database URL and the rest of the test environment are defined in
 * `vitest.config.ts` (`test.env`), so the Prisma client always points to the
 * dedicated test database and never to the development one.
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