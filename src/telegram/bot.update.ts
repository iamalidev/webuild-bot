import { Logger } from '@nestjs/common';
import { Update, Start, On, Command, Ctx, Hears } from 'nestjs-telegraf';
import type { BotContext } from './types/context.type';
import { CourseService } from '../features/course/course.service';
import { PaymentService } from '../features/payment/payment.service';
import { AdminService } from '../features/admin/admin.service';
import { AppConfigService } from '../config/app-config.service';

/**
 * Asosiy bot routing — barcha buyruqlar va xabarlar shu yerda qayta ishlanadi.
 */
@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private readonly course: CourseService,
    private readonly payment: PaymentService,
    private readonly admin: AdminService,
    private readonly config: AppConfigService,
  ) {}

  // ─── /start ──────────────────────────────────────────────────────
  @Start()
  async onStart(@Ctx() ctx: BotContext): Promise<void> {
    const user = ctx.from;
    if (!user) return;

    this.logger.log(`/start — ${user.username ?? user.first_name} (${user.id})`);

    // Foydalanuvchini bazaga yozish
    await this.course.ensureUser(
      user.id,
      user.username,
      user.first_name,
      user.last_name,
    );

    // Kurs ma'lumotini ko'rsatish
    await this.course.showCourseInfo(ctx.chat!.id);
  }

  // ─── /help ───────────────────────────────────────────────────────
  @Command('help')
  async onHelp(@Ctx() ctx: BotContext): Promise<void> {
    await this.course.showHowToPay(ctx.chat!.id);
  }

  // ─── Photo (chek rasmi) ──────────────────────────────────────────
  @On('photo')
  async onPhoto(@Ctx() ctx: BotContext): Promise<void> {
    const user = ctx.from;
    if (!user || !ctx.message || !('photo' in ctx.message)) return;

    // Eng katta o'lchamdagi rasmni olish
    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];

    this.logger.log(`📸 Chek rasmi — ${user.username ?? user.first_name} (${user.id})`);

    await this.payment.handlePaymentPhoto(
      user.id,
      ctx.chat!.id,
      bestPhoto.file_id,
      user.username,
      user.first_name,
    );
  }

  // ─── Callback query (inline tugmalar) ────────────────────────────
  @On('callback_query')
  async onCallback(@Ctx() ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const data = ctx.callbackQuery.data;
    const user = ctx.from;
    if (!user) return;

    // Kurs haqida tugmalar
    if (data === 'how_to_pay') {
      await ctx.answerCbQuery();
      await this.course.showHowToPay(ctx.chat!.id);
      return;
    }

    if (data === 'contact_admin') {
      await ctx.answerCbQuery();
      await this.course.showContactAdmin(ctx.chat!.id);
      return;
    }

    // Admin tugmalari — approve/reject
    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      // Admin ekanligini tekshirish
      if (!this.config.isOwner(user.id)) {
        await ctx.answerCbQuery('⛔ Sizda admin huquqi yo\'q!', { show_alert: true });
        return;
      }

      const [action, idStr] = data.split(':');
      const paymentId = Number(idStr);

      if (!Number.isFinite(paymentId)) {
        await ctx.answerCbQuery('⚠️ Xato format');
        return;
      }

      let result: string;
      if (action === 'approve') {
        result = await this.payment.approvePayment(paymentId, user.id);
      } else {
        result = await this.payment.rejectPayment(paymentId, user.id);
      }

      await ctx.answerCbQuery();

      // Admin xabarini yangilash
      try {
        await ctx.editMessageCaption(result, { parse_mode: 'HTML' });
      } catch {
        // Xabar o'zgartirib bo'lmasa — yangi xabar yuborish
        await ctx.reply(result, { parse_mode: 'HTML' });
      }
      return;
    }

    await ctx.answerCbQuery();
  }

  // ─── /pending (admin) ────────────────────────────────────────────
  @Command('pending')
  async onPending(@Ctx() ctx: BotContext): Promise<void> {
    const user = ctx.from;
    if (!user || !this.config.isOwner(user.id)) {
      await ctx.reply('⛔ Bu buyruq faqat admin uchun.');
      return;
    }

    const result = await this.payment.getPendingPayments();
    await ctx.reply(result, { parse_mode: 'HTML' });
  }

  // ─── /stats (admin) ─────────────────────────────────────────────
  @Command('stats')
  async onStats(@Ctx() ctx: BotContext): Promise<void> {
    const user = ctx.from;
    if (!user || !this.config.isOwner(user.id)) {
      await ctx.reply('⛔ Bu buyruq faqat admin uchun.');
      return;
    }

    const result = await this.admin.getStats();
    await ctx.reply(result, { parse_mode: 'HTML' });
  }

  // ─── /broadcast (admin) ─────────────────────────────────────────
  @Command('broadcast')
  async onBroadcast(@Ctx() ctx: BotContext): Promise<void> {
    const user = ctx.from;
    if (!user || !this.config.isOwner(user.id)) {
      await ctx.reply('⛔ Bu buyruq faqat admin uchun.');
      return;
    }

    if (!ctx.message || !('text' in ctx.message)) return;

    // /broadcast dan keyingi matnni olish
    const text = ctx.message.text.replace(/^\/broadcast\s*/, '').trim();

    if (!text) {
      await ctx.reply(
        '📤 <b>Broadcast qanday ishlatiladi:</b>\n\n<code>/broadcast Salom hammaga! Yangi kurs tayyor!</code>',
        { parse_mode: 'HTML' },
      );
      return;
    }

    await ctx.reply('📤 Xabar yuborilmoqda...');
    const result = await this.admin.broadcast(text);
    await ctx.reply(result, { parse_mode: 'HTML' });
  }

  // ─── Boshqa matnli xabarlar ─────────────────────────────────────
  @On('text')
  async onText(@Ctx() ctx: BotContext): Promise<void> {
    const user = ctx.from;
    if (!user || !ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;

    // Buyruqlarni o'tkazib yuborish (ular yuqorida qayta ishlanadi)
    if (text.startsWith('/')) return;

    // Admin javob yozsa — userga forward qilish kerak emas
    // Oddiy user yozsa — adminga forward
    if (!this.config.isOwner(user.id)) {
      // Bazaga yozish
      await this.course.ensureUser(
        user.id,
        user.username,
        user.first_name,
        user.last_name,
      );

      await this.admin.forwardToAdmin(
        user.id,
        ctx.chat!.id,
        ctx.message.message_id,
        user.username,
        user.first_name,
      );
    }
  }

  // ─── Document, video va boshqa fayllar ───────────────────────────
  @On('document')
  async onDocument(@Ctx() ctx: BotContext): Promise<void> {
    await ctx.reply(
      '📸 Iltimos, chek <b>rasmini</b> yuboring (fayl emas, rasm sifatida).',
      { parse_mode: 'HTML' },
    );
  }
}
