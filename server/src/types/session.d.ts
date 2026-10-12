import "express-session";

declare module "express-session" {
  interface SessionData {
    principal?: { type: "admin" | "team"; id: string };
    csrfToken?: string;
  }
}