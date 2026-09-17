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
        [{ text: '💳 Sotib olish', callback_data: 'how_to_pay' }],
        [{ text: '👨‍💻 Admin bilan aloqa', callback_data: 'contact_admin' }],
      ],
    };

    const photo = this.config.coursePhoto || { source: 'src/assets/images/webuild-banner.jpeg' };

    await this.bot.telegram.sendPhoto(chatId, photo, {
      caption: text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  private buildCourseText(): string {
    return [
      '🚀 Webuild — AI yordamida zamonaviy web saytlar yaratish va ularni mijozlarga sotishni o‘rganadigan onlayn kurs.',
      '',
      'Agar siz frontend bilsangiz yoki umuman web developmentga kirishni xohlasangiz, kurs davomida shunchaki video ko‘rib o‘tirmaysiz — real loyiha yaratishni o‘rganasiz.',
      '',
      'Kursda:',
      '🎨 3D animatsiyali zamonaviy web saytlar yaratish',
      '🤖 AI vositalaridan foydalanib sayt yaratish jarayonini tezlashtirish',
      '📈 18 oylik Google Pro tarifini qanday qilib olish',
      '💼 Tayyor saytni mijozga taklif qilish va sotish',
      '🔎 Mijozlarni qayerdan topish va ularga qanday yozish',
      '🌐 Webuild Community\'ga bepul kirish',
      '💬 24/7 savol-javob va yordam',
      '',
      'Eng muhimi — kursni tugatgandan keyin sizda faqat bilim emas, mijozga ko‘rsatish mumkin bo‘lgan real web loyiha bo‘ladi.',
      '',
      '💰 Kurs narxi: <del>423.000 so‘m</del>',
      '🔥 Hozirgi aksiya: <b>249.000 so‘m</b>',
      '',
      'Agar web sayt yaratishni shunchaki o‘rganish emas, uni xizmatga aylantirib pul ishlash maqsadingiz bo‘lsa — Webuild aynan shu jarayonni ko‘rsatadi. To‘lovdan so‘ng chekni yuborasiz va kursga kirish havolasini olasiz.',
      '',
      '🚀 <i>Keyingi levelni boshlaymiz.</i>'
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
