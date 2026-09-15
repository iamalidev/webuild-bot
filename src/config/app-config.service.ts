import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './env.schema';

/**
 * Tiplangan konfiguratsiya servisi.
 * Kod hech qayerda process.env ga to'g'ridan-to'g'ri murojaat qilmaydi.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config.get(key, { infer: true }) as AppConfig[K];
  }

  // ─── Umumiy ──────────────────────────────────────────────────────
  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
  get port(): number {
    return this.get('PORT');
  }
  get botToken(): string {
    return this.get('BOT_TOKEN');
  }

  // ─── Admin ───────────────────────────────────────────────────────
  /** 👑 Bot egalari ID lari. */
  get ownerIds(): number[] {
    return (this.get('OWNER_IDS') ?? '')
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  isOwner(userId: number): boolean {
    return this.ownerIds.includes(userId);
  }

  // ─── Database ────────────────────────────────────────────────────
  get databaseUrl(): string | undefined {
    return this.get('DATABASE_URL');
  }
  get databaseSchema(): string {
    return this.get('DATABASE_SCHEMA');
  }
  get databasePoolSize(): number {
    return this.get('DATABASE_POOL_SIZE');
  }

  // ─── Kurs ────────────────────────────────────────────────────────
  get courseTitle(): string {
    return this.get('COURSE_TITLE');
  }
  get courseDescription(): string {
    return this.get('COURSE_DESCRIPTION');
  }
  get coursePrice(): string {
    return this.get('COURSE_PRICE');
  }
  get cardNumber(): string {
    return this.get('CARD_NUMBER');
  }
  get cardHolder(): string {
    return this.get('CARD_HOLDER');
  }
  get courseChannelId(): string {
    return this.get('COURSE_CHANNEL_ID');
  }
  get inviteExpireHours(): number {
    return this.get('INVITE_EXPIRE_HOURS');
  }
  get coursePhoto(): string {
    return this.get('COURSE_PHOTO');
  }
}
