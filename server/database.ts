import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg'

let pool: Pool | null = null
let schemaPromise: Promise<void> | null = null

function env(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export function databaseConfigured(): boolean {
  return Boolean(env('DATABASE_URL') || env('PGHOST'))
}

function poolConfig(): PoolConfig {
  const connectionString = env('DATABASE_URL')
  const sslMode = env('PGSSL').toLowerCase()
  const ssl = sslMode === 'require' || sslMode === 'true'
    ? { rejectUnauthorized: env('PGSSL_REJECT_UNAUTHORIZED').toLowerCase() !== 'false' }
    : undefined

  if (connectionString) {
    return {
      connectionString,
      max: Number(env('PGPOOL_MAX')) || 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'lifeos-api',
      ssl,
    }
  }

  return {
    host: env('PGHOST'),
    port: Number(env('PGPORT')) || 5432,
    user: env('PGUSER'),
    password: env('PGPASSWORD'),
    database: env('PGDATABASE'),
    max: Number(env('PGPOOL_MAX')) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'lifeos-api',
    ssl,
  }
}

export function databasePool(): Pool {
  if (!databaseConfigured()) {
    throw new Error('PostgreSQL ist nicht konfiguriert.')
  }
  if (!pool) pool = new Pool(poolConfig())
  return pool
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!databaseConfigured()) return
  if (schemaPromise) return schemaPromise

  schemaPromise = databasePool().query(`
    CREATE TABLE IF NOT EXISTS lifeos_sync_rooms (
      room_id text PRIMARY KEY,
      device_tokens text[] NOT NULL DEFAULT ARRAY[]::text[],
      pair_code text,
      pair_code_expires_at timestamptz,
      snapshot jsonb,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS lifeos_sync_rooms_pair_code_idx
      ON lifeos_sync_rooms (pair_code)
      WHERE pair_code IS NOT NULL;

    CREATE INDEX IF NOT EXISTS lifeos_sync_rooms_updated_at_idx
      ON lifeos_sync_rooms (updated_at DESC);

    CREATE TABLE IF NOT EXISTS lifeos_objects (
      id uuid PRIMARY KEY,
      room_id text NOT NULL REFERENCES lifeos_sync_rooms(room_id) ON DELETE RESTRICT,
      category text NOT NULL,
      storage_key text NOT NULL UNIQUE,
      original_name text NOT NULL,
      content_type text NOT NULL,
      size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
      checksum_sha256 text,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
      created_at timestamptz NOT NULL DEFAULT now(),
      uploaded_at timestamptz
    );

    CREATE INDEX IF NOT EXISTS lifeos_objects_room_created_idx
      ON lifeos_objects (room_id, created_at DESC);
  `).then(() => undefined).catch(error => {
    schemaPromise = null
    throw error
  })

  return schemaPromise
}

export async function databaseQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  await ensureDatabaseSchema()
  return databasePool().query<T>(text, values)
}

export async function probeDatabase(): Promise<{
  ok: boolean
  status: 'ok' | 'not_configured' | 'error'
  error?: string
}> {
  if (!databaseConfigured()) return { ok: false, status: 'not_configured' }
  try {
    await ensureDatabaseSchema()
    await databasePool().query('SELECT 1')
    return { ok: true, status: 'ok' }
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'PostgreSQL nicht erreichbar.',
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (!pool) return
  const current = pool
  pool = null
  schemaPromise = null
  await current.end()
}
