import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { Request, Response } from 'express';

@Controller('api')
export class WebhookController {
  constructor(@InjectBot() private readonly bot: Telegraf<any>) {}

  @Post('index')
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      await this.bot.handleUpdate(req.body, res);
    } catch (e) {
      console.error('Webhook xatosi:', e);
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Error');
      }
    }
  }
}
