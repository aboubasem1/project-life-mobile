import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg'

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

    CREATE TABLE IF NOT EXISTS lifeos_reels (
      id uuid PRIMARY KEY,
      room_id text NOT NULL REFERENCES lifeos_sync_rooms(room_id) ON DELETE RESTRICT,
      object_id uuid NOT NULL REFERENCES lifeos_objects(id) ON DELETE RESTRICT,
      checksum_sha256 text,
      status text NOT NULL DEFAULT 'UPLOADED' CHECK (status IN (
        'UPLOADED', 'PROCESSING', 'EXTRACTED', 'CLASSIFIED', 'FACT_CHECK_PENDING',
        'REVIEW_READY', 'USER_REVIEWED', 'APPROVED_CANDIDATE', 'REJECTED',
        'SOURCE_ONLY', 'MORE_EVIDENCE', 'FAILED', 'DUPLICATE', 'SUPERSEDED'
      )),
      title text NOT NULL DEFAULT '',
      summary text NOT NULL DEFAULT '',
      transcript text NOT NULL DEFAULT '',
      transcript_provider text,
      transcript_model text,
      life_area text,
      topics jsonb NOT NULL DEFAULT '[]'::jsonb,
      usefulness_score integer CHECK (usefulness_score BETWEEN 0 AND 100),
      risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
      suggested_target text CHECK (suggested_target IS NULL OR suggested_target IN ('knowledge', 'guideline', 'source_only', 'reject')),
      jev_result jsonb,
      analysis jsonb,
      reviewer_note text NOT NULL DEFAULT '',
      processing_attempts integer NOT NULL DEFAULT 0,
      error_message text,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz,
      approved_at timestamptz
    );

    CREATE UNIQUE INDEX IF NOT EXISTS lifeos_reels_object_idx
      ON lifeos_reels (object_id);

    CREATE INDEX IF NOT EXISTS lifeos_reels_room_status_idx
      ON lifeos_reels (room_id, status, created_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS lifeos_reels_room_checksum_active_idx
      ON lifeos_reels (room_id, checksum_sha256)
      WHERE checksum_sha256 IS NOT NULL AND status NOT IN ('DUPLICATE', 'SUPERSEDED');

    CREATE TABLE IF NOT EXISTS lifeos_reel_claims (
      id uuid PRIMARY KEY,
      reel_id uuid NOT NULL REFERENCES lifeos_reels(id) ON DELETE CASCADE,
      position integer NOT NULL,
      claim_text text NOT NULL,
      claim_type text NOT NULL DEFAULT 'general',
      verification_status text NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (verification_status IN (
        'SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'UNVERIFIED', 'REVIEW_REQUIRED'
      )),
      confidence numeric(5,4),
      evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
      verifier_note text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (reel_id, position)
    );

    CREATE INDEX IF NOT EXISTS lifeos_reel_claims_reel_idx
      ON lifeos_reel_claims (reel_id, position);

    CREATE TABLE IF NOT EXISTS lifeos_reel_audit (
      id bigserial PRIMARY KEY,
      reel_id uuid NOT NULL REFERENCES lifeos_reels(id) ON DELETE CASCADE,
      room_id text NOT NULL,
      actor text NOT NULL,
      action text NOT NULL,
      from_status text,
      to_status text,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS lifeos_reel_audit_reel_idx
      ON lifeos_reel_audit (reel_id, created_at DESC);

    ALTER TABLE lifeos_reels ADD COLUMN IF NOT EXISTS knowledge_item_id text;
    ALTER TABLE lifeos_reels ADD COLUMN IF NOT EXISTS published_at timestamptz;
    ALTER TABLE lifeos_reels ADD COLUMN IF NOT EXISTS publish_snapshot jsonb;

    ALTER TABLE lifeos_reels DROP CONSTRAINT IF EXISTS lifeos_reels_status_check;
    ALTER TABLE lifeos_reels ADD CONSTRAINT lifeos_reels_status_check CHECK (status IN (
      'UPLOADED', 'PROCESSING', 'EXTRACTED', 'CLASSIFIED', 'FACT_CHECK_PENDING',
      'REVIEW_READY', 'USER_REVIEWED', 'APPROVED_CANDIDATE', 'REJECTED',
      'SOURCE_ONLY', 'MORE_EVIDENCE', 'FAILED', 'DUPLICATE', 'SUPERSEDED', 'PUBLISHED'
    ));

    CREATE UNIQUE INDEX IF NOT EXISTS lifeos_reels_room_knowledge_idx
      ON lifeos_reels (room_id, knowledge_item_id)
      WHERE knowledge_item_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS lifeos_reel_jobs (
      id uuid PRIMARY KEY,
      reel_id uuid NOT NULL REFERENCES lifeos_reels(id) ON DELETE CASCADE,
      room_id text NOT NULL,
      status text NOT NULL CHECK (status IN ('queued', 'running', 'retry', 'succeeded', 'dead')),
      attempts integer NOT NULL DEFAULT 0,
      max_attempts integer NOT NULL DEFAULT 4,
      run_after timestamptz NOT NULL DEFAULT now(),
      locked_at timestamptz,
      locked_by text,
      last_error text,
      life_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS lifeos_reel_jobs_claim_idx
      ON lifeos_reel_jobs (run_after, created_at)
      WHERE status IN ('queued', 'retry', 'running');

    CREATE INDEX IF NOT EXISTS lifeos_reel_jobs_reel_idx
      ON lifeos_reel_jobs (reel_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS lifeos_reel_jobs_room_created_idx
      ON lifeos_reel_jobs (room_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS lifeos_knowledge_documents (
      room_id text NOT NULL REFERENCES lifeos_sync_rooms(room_id) ON DELETE CASCADE,
      knowledge_id text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      topics jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_updated_at text NOT NULL,
      search_vector tsvector NOT NULL,
      PRIMARY KEY (room_id, knowledge_id)
    );

    CREATE INDEX IF NOT EXISTS lifeos_knowledge_documents_search_idx
      ON lifeos_knowledge_documents USING gin (search_vector);
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

export type SqlQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
) => Promise<QueryResult<T>>

export async function databaseTransaction<T>(fn: (query: SqlQuery, client: PoolClient) => Promise<T>): Promise<T> {
  await ensureDatabaseSchema()
  const client = await databasePool().connect()
  const query: SqlQuery = (text, values = []) => client.query(text, values)
  try {
    await client.query('BEGIN')
    const result = await fn(query, client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
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
