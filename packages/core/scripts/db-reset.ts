import postgres from "postgres";
import { env } from "../src/config.js";

// Dev-only: wipes the public schema and drizzle's own migration-tracking
// schema, so the next `drizzle-kit migrate` re-applies every migration
// from scratch instead of thinking they already ran.
const sql = postgres(env.DATABASE_URL);

await sql`DROP SCHEMA IF EXISTS public CASCADE`;
await sql`CREATE SCHEMA public`;
await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;

await sql.end();
