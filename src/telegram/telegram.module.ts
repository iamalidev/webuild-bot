import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';

import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { FeaturesModule } from '../features/features.module';
import { BotUpdate } from './bot.update';

/**
 * Telegram bot moduli — polling mode.
 */
@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        token: config.botToken,
        launchOptions: {
          allowedUpdates: [
            'message',
            'callback_query',
          ],
        },
      }),
    }),
    FeaturesModule,
  ],
  providers: [BotUpdate],
})
export class TelegramModule {}
