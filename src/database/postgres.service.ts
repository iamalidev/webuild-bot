import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { AppConfigService } from '../config/app-config.service';
import { MIGRATIONS } from './migrations';

/**
 * PostgreSQL ulanishi va migratsiyalar.
 *
 * ★ Baza ISHLAMASA bot baribir ishlashda davom etadi — lekin to'lovlar
 *   va foydalanuvchilar saqlanmaydi. Shuning uchun baza kerak.
 */
@Injectable()
export class PostgresService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool | null = null;
  private ready = false;

  constructor(private readonly config: AppConfigService) {}

  get isReady(): boolean {
    return this.ready;
  }

  get enabled(): boolean {
    return !!this.config.databaseUrl;
  }

  async onApplicationBootstrap(): Promise<void> {
    const url = this.config.databaseUrl;
    if (!url) {
      this.logger.warn('DATABASE_URL berilmagan — Postgres o\'chirilgan.');
      return;
    }

    const schema = this.config.databaseSchema;
    quoteIdent(schema);

    this.pool = new Pool({
      connectionString: url,
      max: this.config.databasePoolSize,
      application_name: 'webuild-bot',
      connectionTimeoutMillis: 10_000,
      options: `-c search_path=${schema},public`,
    });

    this.pool.on('error', (e) => this.logger.error(`Pool xatosi: ${e.message}`));

    try {
      await this.migrate();
      this.ready = true;
      this.logger.log('PostgreSQL tayyor ✅');
    } catch (e) {
      this.logger.error(`Postgres ishga tushmadi: ${(e as Error).message}`);
      this.logger.warn('Bot Postgres SIZ ishlashda davom etadi.');
      this.ready = false;
      this.scheduleReconnect();
    }
  }

  // ─── Reconnect ───────────────────────────────────────────────────
  private reconnectTimer: NodeJS.Timeout | null = null;

  private scheduleReconnect(delayMs = 15_000): void {
    if (this.reconnectTimer || !this.pool) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.tryReconnect(delayMs);
    }, delayMs);
    this.reconnectTimer.unref?.();
  }

  private async tryReconnect(previousDelay: number): Promise<void> {
    if (this.ready || !this.pool) return;
    try {
      await this.migrate();
      this.ready = true;
      this.logger.log('Postgres qayta ulandi ✅');
    } catch (e) {
      this.logger.warn(`Postgres hali ham mavjud emas: ${(e as Error).message}`);
      this.scheduleReconnect(Math.min(previousDelay * 2, 300_000));
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    await this.pool?.end().catch(() => undefined);
    this.pool = null;
    this.ready = false;
  }

  // ─── Migratsiya ──────────────────────────────────────────────────
  private async migrate(): Promise<void> {
    const schema = this.config.databaseSchema;

    await this.pool!.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);

    await this.pool!.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent(schema)}.schema_migration (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const migration of MIGRATIONS) {
      const applied = await this.pool!.query(
        `SELECT 1 FROM ${quoteIdent(schema)}.schema_migration WHERE name = $1`,
        [migration.name],
      );
      if (applied.rowCount) continue;

      await this.transaction(async (client) => {
        await client.query(`SET LOCAL search_path TO ${quoteIdent(schema)}, public`);
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${quoteIdent(schema)}.schema_migration (name) VALUES ($1)`,
          [migration.name],
        );
      });
      this.logger.log(`Migratsiya bajarildi: ${migration.name}`);
    }
  }

  // ─── Query & Transaction ─────────────────────────────────────────
  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    if (!this.pool) throw new Error('Postgres ulanmagan');
    const res = await this.pool.query<T>(sql, params as never[]);
    return res.rows;
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('Postgres ulanmagan');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `SET LOCAL search_path TO ${quoteIdent(this.config.databaseSchema)}, public`,
      );
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
}

/** Sxema nomini xavfsiz qo'shtirnoqqa olish (SQL injection oldini oladi). */
export function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`Sxema nomi noto'g'ri: ${name}`);
  }
  return `"${name}"`;
}
