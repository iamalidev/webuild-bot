import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AnalyticsController {
  @Get()
  getHome(@Res() res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WeBuild Bot - Status</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
        }
        h1 {
            color: #333;
            margin-bottom: 1rem;
        }
        .status {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #10b981;
            color: white;
            border-radius: 2rem;
            font-weight: 600;
            margin: 1rem 0;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
        .emoji {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">🤖</div>
        <h1>WeBuild Bot</h1>
        <div class="status">✓ Online</div>
        <p>The bot is running and ready to receive Telegram webhooks.</p>
        <p><small>Powered by NestJS & Telegraf</small></p>
    </div>
    <script>
        (function() {
            var script = document.createElement('script');
            script.defer = true;
            script.src = '/_vercel/insights/script.js';
            document.head.appendChild(script);
        })();
    </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('health')
  getHealth(@Res() res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WeBuild Bot - Health Check</title>
    <style>
        body {
            font-family: monospace;
            padding: 2rem;
            background: #1a1a1a;
            color: #0f0;
        }
        .health-info {
            background: #000;
            padding: 2rem;
            border: 2px solid #0f0;
            border-radius: 0.5rem;
            max-width: 600px;
            margin: 0 auto;
        }
        h1 { margin-top: 0; }
        .status-line { margin: 0.5rem 0; }
    </style>
</head>
<body>
    <div class="health-info">
        <h1>⚡ Health Check</h1>
        <div class="status-line">Status: OK</div>
        <div class="status-line">Timestamp: ${new Date().toISOString()}</div>
        <div class="status-line">Node Version: ${process.version}</div>
        <div class="status-line">Uptime: ${Math.floor(process.uptime())}s</div>
    </div>
    <script>
        (function() {
            var script = document.createElement('script');
            script.defer = true;
            script.src = '/_vercel/insights/script.js';
            document.head.appendChild(script);
        })();
    </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
