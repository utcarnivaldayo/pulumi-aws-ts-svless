import { defineConfig } from 'drizzle-kit';

const PG_USER = process.env.PG_USER || 'admin';
const PG_PASSWORD = process.env.PG_PASSWORD || '';
const PG_HOST = process.env.PG_HOST || '';
const PG_PORT = Number(process.env.PG_PORT) || 5432;
const PG_DATABASE = process.env.PG_DATABASE || 'postgres';

export default defineConfig(
  {
    dialect: "postgresql",
    schema: "./src/infra/schema",
    out: "./drizzle",
    schemaFilter: ["api"],
    dbCredentials: {
      host: PG_HOST,
      port: PG_PORT,
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
      ssl: true,
    }
  }
);
