import { Module } from '@nestjs/common';

import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { FeaturesModule } from './features/features.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    FeaturesModule,
    TelegramModule,
  ],
})
export class AppModule {}
