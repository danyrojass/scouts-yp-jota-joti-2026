import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://ypacarai:ypacarai@127.0.0.1:5433/ypacarai_test?schema=public";

// Same DDL connect-pg-simple uses when createTableIfMissing is enabled.
const SESSION_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;

export default async function globalSetup() {
  const schemaPath = resolve(__dirname, "../prisma/schema.prisma");
  execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await pool.query(SESSION_TABLE_DDL);
  } finally {
    await pool.end();
  }

  // eslint-disable-next-line no-console
  console.log("[tests] Esquema de test aplicado y tabla de sesiones creada.");
}