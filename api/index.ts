import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import express from 'express';
import { INestApplication } from '@nestjs/common';
import { VercelRequest, VercelResponse } from '@vercel/node';

let cachedApp: INestApplication;
let cachedServer: express.Express;

async function bootstrap() {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { bufferLogs: false }
    );
    app.enableShutdownHooks();
    
    // Serverless muhitda global prefix kabi narsalarni ham qo'shishingiz mumkin
    // Bot webhook qabul qilishi uchun u ishga tushishi kerak
    await app.init();
    
    cachedApp = app;
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const server = await bootstrap();
  server(req, res);
}
