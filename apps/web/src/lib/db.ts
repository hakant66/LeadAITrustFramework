// src/lib/db.ts
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.AUTH_DATABASE_URL?.replace(/\?schema=auth$/, "");

if (!connectionString) {
  throw new Error("DATABASE_URL is required for server-side Postgres access");
}

export const pool = new Pool({
  connectionString,
});
