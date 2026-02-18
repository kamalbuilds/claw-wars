import pg from "pg";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const dbLogger = logger.child("DB");

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  return pool;
}

export function isDbEnabled(): boolean {
  return pool !== null;
}

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS completed_games (
    game_id          TEXT        PRIMARY KEY,
    chain_game_id    TEXT,
    result           SMALLINT    NOT NULL,
    round_number     SMALLINT    NOT NULL,
    max_rounds       SMALLINT    NOT NULL,
    max_players      SMALLINT    NOT NULL,
    stake_per_player TEXT        NOT NULL,
    players          JSONB       NOT NULL,
    eliminations     JSONB       NOT NULL,
    vote_history     JSONB       NOT NULL,
    messages         JSONB       NOT NULL,
    created_at       BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    ended_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS agent_stats (
    address        TEXT        PRIMARY KEY,
    name           TEXT        NOT NULL,
    games_played   INT         NOT NULL DEFAULT 0,
    wins           INT         NOT NULL DEFAULT 0,
    impostor_games INT         NOT NULL DEFAULT 0,
    impostor_wins  INT         NOT NULL DEFAULT 0,
    elo            INT         NOT NULL DEFAULT 1000,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_agent_stats_wins
    ON agent_stats (wins DESC);

  CREATE INDEX IF NOT EXISTS idx_completed_games_ended
    ON completed_games (ended_at DESC);
`;

export async function initDb(): Promise<void> {
  if (!config.database.url) {
    dbLogger.warn("DATABASE_URL not set — running in memory-only mode");
    return;
  }

  try {
    pool = new pg.Pool({
      connectionString: config.database.url,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: config.database.url.includes("localhost") ? false : { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    await client.query(MIGRATION_SQL);
    client.release();

    dbLogger.info("PostgreSQL connected and schema migrated");
  } catch (err) {
    dbLogger.error("Failed to connect to PostgreSQL — falling back to memory-only", err);
    pool = null;
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbLogger.info("PostgreSQL pool closed");
  }
}
