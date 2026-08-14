import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it."
    );
  }
  return postgres(connectionString, { max: 10, idle_timeout: 20 });
}

const client = createClient();

export const db = drizzle(client, { schema });
export type Database = typeof db;
