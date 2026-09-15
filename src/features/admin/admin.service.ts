import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import type { BotContext } from '../../telegram/types/context.type';
import { AppConfigService } from '../../config/app-config.service';
import { PostgresService } from '../../database/postgres.service';

interface StatsRow {
  total_users: string;
  total_payments: string;
  pending: string;
  approved: string;
  rejected: string;
}

/**
 * Admin funksiyalari — statistika, broadcast.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly config: AppConfigService,
    private readonly db: PostgresService,
  ) {}

  /**
   * Statistika — /stats buyrug'i uchun.
   */
  async getStats(): Promise<string> {
    if (!this.db.isReady) return '⚠️ Database ulanmagan';

    const rows = await this.db.query<StatsRow>(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM payments) AS total_payments,
        (SELECT COUNT(*) FROM payments WHERE status = 'pending') AS pending,
        (SELECT COUNT(*) FROM payments WHERE status = 'approved') AS approved,
        (SELECT COUNT(*) FROM payments WHERE status = 'rejected') AS rejected
    `);

    const s = rows[0];

    return [
      '📊 <b>Bot Statistikasi</b>',
      '',
      `👥 Jami foydalanuvchilar: <b>${s.total_users}</b>`,
      `📋 Jami to'lov so'rovlari: <b>${s.total_payments}</b>`,
      '',
      `⏳ Kutilayotgan: <b>${s.pending}</b>`,
      `✅ Tasdiqlangan: <b>${s.approved}</b>`,
      `❌ Rad etilgan: <b>${s.rejected}</b>`,
    ].join('\n');
  }

  /**
   * Broadcast — /broadcast buyrug'i uchun.
   * Barcha foydalanuvchilarga xabar yuborish.
   */
  async broadcast(text: string): Promise<string> {
    if (!this.db.isReady) return '⚠️ Database ulanmagan';
    if (!text.trim()) return '⚠️ Xabar matni bo\'sh!';

    const users = await this.db.query<{ id: number }>(
      `SELECT id FROM users WHERE is_blocked = false`,
    );

    if (users.length === 0) return '⚠️ Foydalanuvchilar yo\'q.';

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await this.bot.telegram.sendMessage(user.id, text, {
          parse_mode: 'HTML',
        });
        sent++;
      } catch (e) {
        failed++;
        // User botni bloklagan bo'lsa
        const errMsg = (e as Error).message;
        if (errMsg.includes('blocked') || errMsg.includes('deactivated')) {
          await this.db.query(
            `UPDATE users SET is_blocked = true WHERE id = $1`,
            [user.id],
          ).catch(() => undefined);
        }
      }

      // Telegram rate limit — sekundiga ~30 xabar
      if ((sent + failed) % 25 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return [
      '📤 <b>Broadcast natijasi:</b>',
      '',
      `✅ Yuborildi: <b>${sent}</b>`,
      `❌ Xatolik: <b>${failed}</b>`,
      `👥 Jami: <b>${users.length}</b>`,
    ].join('\n');
  }

  /**
   * User adminga xabar yuborganda — forward qilish.
   */
  async forwardToAdmin(
    userId: number,
    chatId: number,
    messageId: number,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const adminIds = this.config.ownerIds;
    if (adminIds.length === 0) return;

    const userInfo = username ? `@${username}` : firstName ?? `ID: ${userId}`;

    for (const adminId of adminIds) {
      try {
        // Avval user haqida qisqa info
        await this.bot.telegram.sendMessage(
          adminId,
          `💬 <b>Yangi xabar</b> — ${userInfo} (ID: <code>${userId}</code>)`,
          { parse_mode: 'HTML' },
        );
        // Keyin xabarni forward
        await this.bot.telegram.forwardMessage(adminId, chatId, messageId);
      } catch (e) {
        this.logger.error(`Admin ${adminId} ga forward xatosi: ${(e as Error).message}`);
      }
    }

    await this.bot.telegram.sendMessage(
      chatId,
      '📩 Xabaringiz adminga yuborildi! Tez orada javob olasiz.',
    );
  }
}
