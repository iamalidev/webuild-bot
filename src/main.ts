import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();

  await app.listen(3000);

  logger.log('🤖 WeBuild Bot ishga tushdi!');
  logger.log('HTTP: http://localhost:3000');
}

void bootstrap().catch((e) => {
  console.error('Ishga tushirishda xato:\n', e instanceof Error ? e.message : e);
  process.exit(1);
});
