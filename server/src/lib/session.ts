import session from "express-session";
import connectPgSimpleFactory from "connect-pg-simple";
import { env } from "@/config/env";
import { dbPool } from "@/lib/dbPool";

const ConnPgStore = connectPgSimpleFactory(session);

export const sessionStore = new (ConnPgStore as unknown as typeof ConnPgStore)({
  pool: dbPool,
  tableName: "session",
  createTableIfMissing: true,
  ttl: env.SESSION_TTL_HOURS * 3600,
  pruneSessionInterval: 60 * 60,
});

export { dbPool as pgPool };

export const sessionMiddleware = session({
  name: env.SESSION_COOKIE_NAME,
  secret: env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    maxAge: env.SESSION_TTL_HOURS * 3600 * 1000,
    path: "/",
  },
});
