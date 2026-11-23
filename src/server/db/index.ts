import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import { getEnv } from '../config/env';

let pool: Pool | undefined;
let database: ReturnType<typeof createDatabase> | undefined;

// Neon uses WebSockets for server-side Postgres connections. Node 22 exposes
// the standard WebSocket constructor globally; wire it explicitly so the
// serverless driver does not depend on an implicit runtime default.
if (typeof globalThis.WebSocket === 'function' && !neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

// Most application and auth queries are single statements. Send those through
// Neon's HTTPS query endpoint so a blocked or unreliable WebSocket proxy does
// not take down session checks and OAuth state writes. Drizzle transactions
// still use the Pool's normal connection path when they are explicitly needed.
neonConfig.poolQueryViaFetch = true;

// The HTTP transport can fail transiently during local development (VPN/DNS
// changes and laptop sleep are common causes). Retry only network-level fetch
// failures; SQL responses are returned untouched and are never retried here.
if (typeof globalThis.fetch === 'function' && !neonConfig.fetchFunction) {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  neonConfig.fetchFunction = async (input: RequestInfo | URL, init?: RequestInit) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await nativeFetch(input, init);
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
    throw lastError;
  };
}

function createDatabase() {
  const { DATABASE_URL, DATABASE_URL_UNPOOLED } = getEnv();
  // Neon’s HTTP/WebSocket serverless transport derives its API endpoint from
  // the direct endpoint. A `-pooler` hostname produces an invalid API host
  // (and a 443 timeout), so prefer the unpooled URL when it is available.
  const connectionString = DATABASE_URL_UNPOOLED ?? DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to use the Neon database.');
  pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 8_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
  });
  pool.on('error', () => {
    // Never print raw driver errors (which can contain connection details) or
    // trigger Next's development error overlay for a transient network fault.
    if (process.env.NODE_ENV === 'production') {
      console.error('[database] Neon connection unavailable.');
    }
  });
  return drizzle({ client: pool, schema });
}

export function getDatabase() {
  if (database) return database;
  database = createDatabase();
  return database;
}

export async function closeDatabase() {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
