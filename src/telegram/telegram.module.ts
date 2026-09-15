import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';

import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { FeaturesModule } from '../features/features.module';
import { BotUpdate } from './bot.update';

/**
 * Telegram bot moduli — mahalliy kompyuterda polling, Vercel'da webhook mode.
 */
@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const isVercel = !!process.env.VERCEL || config.nodeEnv === 'production';
        const domain = process.env.WEBHOOK_DOMAIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''));
        
        return {
          token: config.botToken,
          launchOptions: isVercel && domain ? {
            webhook: {
              domain,
              path: '/api/index',
            },
            allowedUpdates: ['message', 'callback_query'],
          } : {
            allowedUpdates: ['message', 'callback_query'],
          },
        };
      },
    }),
    FeaturesModule,
  ],
  providers: [BotUpdate],
})
export class TelegramModule {}
