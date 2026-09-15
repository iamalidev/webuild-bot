import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import type { BotContext } from '../../telegram/types/context.type';
import { AppConfigService } from '../../config/app-config.service';
import { PostgresService } from '../../database/postgres.service';

/**
 * Kurs haqida ma'lumot ko'rsatish va foydalanuvchini bazaga yozish.
 */
@Injectable()
export class CourseService {
  private readonly logger = new Logger(CourseService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly config: AppConfigService,
    private readonly db: PostgresService,
  ) {}

  /**
   * Foydalanuvchini bazaga yozish (agar yo'q bo'lsa).
   */
  async ensureUser(
    userId: number,
    username?: string,
    firstName?: string,
    lastName?: string,
  ): Promise<void> {
    if (!this.db.isReady) return;
    try {
      await this.db.query(
        `INSERT INTO users (id, username, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           username   = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name  = EXCLUDED.last_name`,
        [userId, username ?? null, firstName ?? 'Foydalanuvchi', lastName ?? null],
      );
    } catch (e) {
      this.logger.error(`User yozishda xato: ${(e as Error).message}`);
    }
  }

  /**
   * Kurs haqida batafsil ma'lumot — rasm + matn + inline tugmalar.
   */
  async showCourseInfo(chatId: number): Promise<void> {
    const text = this.buildCourseText();
    const keyboard = {
      inline_keyboard: [
        [{ text: '📸 Chek yuborish haqida', callback_data: 'how_to_pay' }],
        [{ text: '💬 Savollar bormi?', callback_data: 'contact_admin' }],
      ],
    };

    const photo = this.config.coursePhoto;

    if (photo) {
      await this.bot.telegram.sendPhoto(chatId, photo, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  }

  private buildCourseText(): string {
    return [
      `🎓 <b>${this.config.courseTitle}</b>`,
      '',
      `📚 ${this.config.courseDescription}`,
      '',
      `💰 <b>Narxi: ${this.config.coursePrice}</b>`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '',
      '💳 <b>To\'lov uchun:</b>',
      `💳 Karta: <code>${this.config.cardNumber}</code>`,
      `👤 Karta egasi: ${this.config.cardHolder}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '',
      '✅ To\'lov qilganingizdan keyin <b>chek rasmini shu botga yuboring!</b>',
      '',
      '⏱ Admin tekshirib, tez orada kurs linkini yuboradi.',
    ].join('\n');
  }

  /**
   * To'lov qilish bo'yicha ko'rsatma.
   */
  async showHowToPay(chatId: number): Promise<void> {
    const text = [
      '📸 <b>Chek yuborish tartibi:</b>',
      '',
      '1️⃣ Yuqoridagi karta raqamiga to\'lov qiling',
      `   💳 <code>${this.config.cardNumber}</code>`,
      `   💰 ${this.config.coursePrice}`,
      '',
      '2️⃣ To\'lov chekini <b>rasmga oling</b>',
      '',
      '3️⃣ Rasmni <b>shu botga yuboring</b>',
      '',
      '4️⃣ Admin tekshirib, kurs linkini yuboradi ✅',
      '',
      '⏱ Tekshirish odatda <b>1-24 soat</b> ichida amalga oshadi.',
    ].join('\n');

    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
    });
  }

  /**
   * Admin bilan bog'lanish.
   */
  async showContactAdmin(chatId: number): Promise<void> {
    const ownerIds = this.config.ownerIds;
    let text: string;

    if (ownerIds.length > 0) {
      text = [
        '💬 <b>Savollaringiz bormi?</b>',
        '',
        'Shu botga xabaringizni yozing — admin tez orada javob beradi! 📩',
      ].join('\n');
    } else {
      text = '💬 Savollaringiz bo\'lsa, shu botga yozing!';
    }

    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
    });
  }
}
