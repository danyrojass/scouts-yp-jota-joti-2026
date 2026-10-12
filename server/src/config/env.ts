import "dotenv/config";
import { z } from "zod";

const boolFromString = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

/**
 * Number of trusted proxy hops in front of the app. Express and
 * express-rate-limit expect a count (e.g. `1` on Vercel), NOT the boolean
 * `true`, which would let clients spoof `X-Forwarded-For`. `false`/unset/`0`
 * disable it (local dev).
 */
const trustProxyFromString = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === "false" || v === "0") return 0;
    if (v === "true") return 1;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  DATABASE_URL: z
    .string()
    .default("postgresql://ypacarai:ypacarai@localhost:5432/ypacarai?schema=public"),
  SESSION_SECRET: z
    .string()
    .default("dev-insecure-secret-change-me")
    .refine((v) => process.env.NODE_ENV !== "production" || v.length >= 32, {
      message: "SESSION_SECRET must be at least 32 chars in production",
    }),
  SESSION_COOKIE_NAME: z.string().default("ypacarai.sid"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(24),
  COOKIE_SECURE: boolFromString(false),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  TRUST_PROXY: trustProxyFromString,
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  LOGIN_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      "Invalid environment configuration:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
