/**
 * Migratsiyalar — users va payments jadvallarini yaratish.
 */
export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: '001_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id          BIGINT PRIMARY KEY,
        username    TEXT,
        first_name  TEXT NOT NULL,
        last_name   TEXT,
        started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        is_blocked  BOOLEAN NOT NULL DEFAULT false
      );
    `,
  },
  {
    name: '002_create_payments',
    sql: `
      CREATE TABLE IF NOT EXISTS payments (
        id            SERIAL PRIMARY KEY,
        user_id       BIGINT NOT NULL REFERENCES users(id),
        photo_file_id TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'pending',
        admin_id      BIGINT,
        reviewed_at   TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        note          TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    `,
  },
];
