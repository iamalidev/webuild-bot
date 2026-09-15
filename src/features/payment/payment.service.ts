import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import type { BotContext } from '../../telegram/types/context.type';
import { AppConfigService } from '../../config/app-config.service';
import { PostgresService } from '../../database/postgres.service';

export interface PaymentRow {
  id: number;
  user_id: number;
  photo_file_id: string;
  status: string;
  admin_id: number | null;
  reviewed_at: string | null;
  created_at: string;
  note: string | null;
  // JOIN fields
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * To'lovlarni boshqarish — chek qabul qilish, tasdiqlash, rad etish.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly config: AppConfigService,
    private readonly db: PostgresService,
  ) {}

  /**
   * Foydalanuvchi chek rasmini yuborganda.
   */
  async handlePaymentPhoto(
    userId: number,
    chatId: number,
    photoFileId: string,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    if (!this.db.isReady) {
      await this.bot.telegram.sendMessage(
        chatId,
        '⚠️ Hozirda tizimda texnik muammo bor. Iltimos, keyinroq urinib ko\'ring.',
      );
      return;
    }

    // 1. To'lov so'rovini bazaga yozish
    let paymentId: number;
    try {
      const rows = await this.db.query<{ id: number }>(
        `INSERT INTO payments (user_id, photo_file_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [userId, photoFileId],
      );
      paymentId = rows[0].id;
    } catch (e) {
      this.logger.error(`To'lov yozishda xato: ${(e as Error).message}`);
      await this.bot.telegram.sendMessage(
        chatId,
        '⚠️ Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.',
      );
      return;
    }

    // 2. Userga tasdiqlash xabari
    await this.bot.telegram.sendMessage(
      chatId,
      [
        '✅ <b>Chekingiz qabul qilindi!</b>',
        '',
        `📋 So'rov raqami: <b>#${paymentId}</b>`,
        '',
        '⏱ Admin tekshirib, tez orada javob beradi.',
        'Iltimos, kuting...',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );

    // 3. Admin(lar)ga xabar yuborish
    await this.notifyAdmins(paymentId, userId, photoFileId, username, firstName);
  }

  /**
   * Admin(lar)ga chek rasmini va tasdiqlash tugmalarini yuborish.
   */
  private async notifyAdmins(
    paymentId: number,
    userId: number,
    photoFileId: string,
    username?: string,
    firstName?: string,
  ): Promise<void> {
    const adminIds = this.config.ownerIds;
    if (adminIds.length === 0) {
      this.logger.warn('OWNER_IDS berilmagan — admin xabari yuborilmadi!');
      return;
    }

    const userInfo = username ? `@${username}` : firstName ?? `ID: ${userId}`;
    const caption = [
      '🆕 <b>Yangi to\'lov so\'rovi!</b>',
      '',
      `👤 Foydalanuvchi: ${userInfo}`,
      `🆔 User ID: <code>${userId}</code>`,
      `📋 So'rov: <b>#${paymentId}</b>`,
      `📅 Vaqt: ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`,
    ].join('\n');

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: `approve:${paymentId}` },
          { text: '❌ Rad etish', callback_data: `reject:${paymentId}` },
        ],
      ],
    };

    for (const adminId of adminIds) {
      try {
        await this.bot.telegram.sendPhoto(adminId, photoFileId, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (e) {
        this.logger.error(`Admin ${adminId} ga xabar yuborishda xato: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Admin to'lovni tasdiqlaydi — userga 1 martalik kanal linki yuboriladi.
   *
   * ★ Har bir user uchun ALOHIDA invite link yaratiladi:
   *   • member_limit: 1  — faqat 1 ta odam qo'shila oladi
   *   • expire_date       — muddati tugaydi (masalan 24 soatdan keyin)
   *   • name              — admin uchun kim ekanini bilish
   */
  async approvePayment(paymentId: number, adminId: number): Promise<string> {
    if (!this.db.isReady) return '⚠️ Database ulanmagan';

    // 1. To'lovni tekshirish
    const payment = await this.db.queryOne<PaymentRow>(
      `SELECT p.*, u.username, u.first_name FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      [paymentId],
    );

    if (!payment) return `❌ So'rov #${paymentId} topilmadi.`;
    if (payment.status !== 'pending') return `⚠️ So'rov #${paymentId} allaqachon ko'rib chiqilgan (${payment.status}).`;

    // 2. 1 martalik invite link yaratish
    let inviteLink: string;
    try {
      const channelId = this.config.courseChannelId;
      const expireHours = this.config.inviteExpireHours;
      const expireDate = Math.floor(Date.now() / 1000) + expireHours * 3600;
      const userName = payment.username ?? payment.first_name ?? `user_${payment.user_id}`;

      const invite = await this.bot.telegram.createChatInviteLink(channelId, {
        member_limit: 1,
        expire_date: expireDate,
        name: `#${paymentId} — ${userName}`,
      });

      inviteLink = invite.invite_link;
      this.logger.log(`🔗 Invite link yaratildi: #${paymentId} → ${inviteLink}`);
    } catch (e) {
      this.logger.error(`Invite link yaratishda xato: ${(e as Error).message}`);
      return `⚠️ So'rov #${paymentId} — invite link yaratib bo'lmadi! Bot kanalda admin ekanligini tekshiring.`;
    }

    // 3. Statusni yangilash (invite_link ham saqlanadi)
    await this.db.query(
      `UPDATE payments SET status = 'approved', admin_id = $1, reviewed_at = now(), note = $2 WHERE id = $3`,
      [adminId, inviteLink, paymentId],
    );

    // 4. Userga 1 martalik link yuborish
    try {
      await this.bot.telegram.sendMessage(
        payment.user_id,
        [
          '🎉 <b>To\'lovingiz tasdiqlandi!</b>',
          '',
          '🎓 Video kurs kanaliga qo\'shilish:',
          `🔗 ${inviteLink}`,
          '',
          '⚠️ <b>Diqqat:</b> Bu link faqat <b>siz uchun</b> va <b>1 martalik</b>.',
          `⏱ Link ${this.config.inviteExpireHours} soat ichida amal qiladi.`,
          '',
          '✅ Kursdan rohatlaning! Savollar bo\'lsa, yozing.',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
    } catch (e) {
      this.logger.error(`Userga xabar yuborishda xato: ${(e as Error).message}`);
      return `✅ So'rov #${paymentId} tasdiqlandi (link: ${inviteLink}), lekin userga xabar yuborib bo'lmadi.`;
    }

    return `✅ So'rov #${paymentId} tasdiqlandi! 1 martalik link yuborildi.`;
  }

  /**
   * Admin to'lovni rad etadi — userga xabar yuboriladi.
   */
  async rejectPayment(paymentId: number, adminId: number, reason?: string): Promise<string> {
    if (!this.db.isReady) return '⚠️ Database ulanmagan';

    // 1. To'lovni tekshirish
    const payment = await this.db.queryOne<PaymentRow>(
      `SELECT * FROM payments WHERE id = $1`,
      [paymentId],
    );

    if (!payment) return `❌ So'rov #${paymentId} topilmadi.`;
    if (payment.status !== 'pending') return `⚠️ So'rov #${paymentId} allaqachon ko'rib chiqilgan (${payment.status}).`;

    // 2. Statusni yangilash
    await this.db.query(
      `UPDATE payments SET status = 'rejected', admin_id = $1, reviewed_at = now(), note = $2 WHERE id = $3`,
      [adminId, reason ?? null, paymentId],
    );

    // 3. Userga xabar
    try {
      const reasonText = reason ? `\n📝 Sabab: ${reason}` : '';
      await this.bot.telegram.sendMessage(
        payment.user_id,
        [
          '❌ <b>To\'lovingiz rad etildi.</b>',
          reasonText,
          '',
          'Iltimos, to\'g\'ri chek rasmini yuboring yoki admin bilan bog\'laning.',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
    } catch (e) {
      this.logger.error(`Userga xabar yuborishda xato: ${(e as Error).message}`);
    }

    return `❌ So'rov #${paymentId} rad etildi.`;
  }

  /**
   * Kutilayotgan to'lovlar ro'yxati — /pending buyrug'i uchun.
   */
  async getPendingPayments(): Promise<string> {
    if (!this.db.isReady) return '⚠️ Database ulanmagan';

    const rows = await this.db.query<PaymentRow>(
      `SELECT p.*, u.username, u.first_name, u.last_name
       FROM payments p
       JOIN users u ON u.id = p.user_id
       WHERE p.status = 'pending'
       ORDER BY p.created_at ASC`,
    );

    if (rows.length === 0) {
      return '✅ Kutilayotgan to\'lovlar yo\'q!';
    }

    const lines = rows.map((p) => {
      const userInfo = p.username ? `@${p.username}` : p.first_name ?? `ID: ${p.user_id}`;
      const date = new Date(p.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
      return `📋 <b>#${p.id}</b> — ${userInfo} — ${date}`;
    });

    return [
      `⏳ <b>Kutilayotgan to'lovlar (${rows.length}):</b>`,
      '',
      ...lines,
      '',
      'Har bir so\'rov uchun chek rasmi bilan birga ✅/❌ tugmalari yuborilgan.',
    ].join('\n');
  }
}
