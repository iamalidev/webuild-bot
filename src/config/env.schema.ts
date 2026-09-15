import { z } from 'zod';

/**
 * .env validatsiyasi — noto'g'ri konfiguratsiya bilan bot UMUMAN ishga tushmaydi.
 */

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : /^(1|true|yes|on)$/i.test(v)));

const int = (def?: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') {
        if (def === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'majburiy' });
          return z.NEVER;
        }
        return def;
      }
      const n = Number(v);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `raqam emas: ${v}` });
        return z.NEVER;
      }
      return n;
    });

const BOT_TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: int(3000),

  BOT_TOKEN: z
    .string()
    .min(1, 'BOT_TOKEN majburiy')
    .refine((v) => BOT_TOKEN_RE.test(v) || v.startsWith('TEST:'), {
      message: "BOT_TOKEN formati noto'g'ri (BotFather bergan token bo'lishi kerak)",
    }),

  // Bot egalari — admin buyruqlarini faqat shular ishlata oladi.
  OWNER_IDS: z
    .string()
    .optional()
    .default('')
    .refine((v) => v === '' || /^\s*\d+(\s*,\s*\d+)*\s*$/.test(v), {
      message: "OWNER_IDS vergul bilan ajratilgan raqamlar bo'lishi kerak (masalan 501,777)",
    }),

  // ─── PostgreSQL ──────────────────────────────────────────────────
  DATABASE_URL: z
    .string()
    .optional()
    .refine((v) => !v || /^postgres(ql)?:\/\//.test(v), {
      message: "DATABASE_URL 'postgresql://' bilan boshlanishi kerak",
    }),
  DATABASE_SCHEMA: z
    .string()
    .default('public')
    .refine((v) => /^[A-Za-z_][A-Za-z0-9_$]*$/.test(v), {
      message: "DATABASE_SCHEMA faqat harf, raqam va _ dan iborat bo'lishi kerak",
    }),
  DATABASE_POOL_SIZE: int(5),

  // ─── Kurs ma'lumotlari ───────────────────────────────────────────
  COURSE_TITLE: z.string().min(1, 'COURSE_TITLE majburiy'),
  COURSE_DESCRIPTION: z.string().min(1, 'COURSE_DESCRIPTION majburiy'),
  COURSE_PRICE: z.string().min(1, 'COURSE_PRICE majburiy'),
  CARD_NUMBER: z.string().min(1, 'CARD_NUMBER majburiy'),
  CARD_HOLDER: z.string().min(1, 'CARD_HOLDER majburiy'),
  COURSE_CHANNEL_ID: z.string().min(1, 'COURSE_CHANNEL_ID majburiy'),
  INVITE_EXPIRE_HOURS: int(24),
  COURSE_PHOTO: z.string().optional().default(''),
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(`.env xatolari:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
