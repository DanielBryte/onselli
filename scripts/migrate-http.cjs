const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { migrate } = require('drizzle-orm/neon-http/migrator');

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required to run migrations.');
}

const sql = neon(connectionString);
const db = drizzle(sql);

migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') })
  .then(() => console.log('Database migrations applied successfully.'))
  .catch((error) => {
    console.error('Database migration failed:', error?.cause?.message || error.message);
    process.exitCode = 1;
  });
