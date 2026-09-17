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
  ) { }

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
        [{ text: '\ud83d\udcb3 Sotib olish', callback_data: 'how_to_pay' }],
        [{ text: '\ud83d\udc68\u200d\ud83d\udcbb Admin bilan aloqa', callback_data: 'contact_admin' }],
      ],
    };

    const photo = this.config.coursePhoto || 'https://raw.githubusercontent.com/iamalidev/webuild-bot/main/src/assets/images/webuild-banner.jpeg';

    try {
      await this.bot.telegram.sendPhoto(chatId, photo, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (e) {
      this.logger.error(`sendPhoto xato: ${(e as Error).message}`);
      // Rasm bilan yuborib bo'lmasa — faqat matn yuboramiz
      try {
        await this.bot.telegram.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (e2) {
        this.logger.error(`sendMessage ham xato: ${(e2 as Error).message}`);
        // HTML parse xatosi bo'lsa — oddiy matn yuboramiz
        await this.bot.telegram.sendMessage(chatId, text.replace(/<[^>]*>/g, ''), {
          reply_markup: keyboard,
        });
      }
    }
  }

  private buildCourseText(): string {
    return [
      '\ud83d\ude80 Webuild \u2014 AI yordamida zamonaviy web saytlar yaratish va ularni mijozlarga sotishni o\u2018rganadigan onlayn kurs.',
      '',
      'Kursda:',
      '\ud83c\udfa8 3D animatsiyali zamonaviy web saytlar yaratish',
      '\ud83e\udd16 AI vositalaridan foydalanib sayt yaratish jarayonini tezlashtirish',
      '\ud83d\udcc8 18 oylik Google Pro tarifini qanday qilib olish',
      '\ud83d\udcbc Tayyor saytni mijozga taklif qilish va sotish',
      '\ud83d\udd0e Mijozlarni qayerdan topish va ularga qanday yozish',
      '\ud83c\udf10 Webuild Community\'ga bepul kirish',
      '\ud83d\udcac 24/7 savol-javob va yordam',
      '',
      '\ud83d\udcb0 Kurs narxi: <s>423.000 so\u2018m</s>',
      '\ud83d\udd25 Hozirgi aksiya: <b>249.000 so\u2018m</b>',
      '',
      'Agar web sayt yaratishni shunchaki o\u2018rganish emas, uni xizmatga aylantirib pul ishlash maqsadingiz bo\u2018lsa \u2014 Webuild aynan shu jarayonni ko\u2018rsatadi. To\u2018lovdan so\u2018ng chekni yuborasiz va kursga kirish havolasini olasiz.',
      '',
      '\ud83d\ude80 <i>Keyingi levelni boshlaymiz.</i>',
    ].join('\n');
  }

  /**
   * To'lov qilish bo'yicha ko'rsatma.
   */
  async showHowToPay(chatId: number): Promise<void> {
    const text = [
      '💳 <b>To\'lov uchun:</b>',
      `💳 Karta: <code>${this.config.cardNumber}</code>`,
      `👤 Karta egasi: ${this.config.cardHolder}`,
      '',
      '✅ To\'lov qilganingizdan keyin chek rasmini shu botga yuboring!',
      '',
      '⏱️ Admin tekshirib, tez orada kurs linkini yuboradi.',
    ].join('\n');

    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
    });
  }

  async showContactAdmin(chatId: number): Promise<void> {
    const text = '💬 Adminga savollaringizni bering (shu yerga yozib yuboring):';
    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
    });
  }
}
