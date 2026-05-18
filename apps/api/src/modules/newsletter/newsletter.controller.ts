import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto } from './newsletter.dto';

function page(title: string, message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:12% auto;padding:40px;text-align:center;">
  <div style="font-size:22px;font-weight:700;color:#D4A017;margin-bottom:24px;">African Youth Observatory</div>
  <h1 style="color:#fff;font-size:20px;margin:0 0 12px;">${title}</h1>
  <p style="color:#bbb;font-size:15px;line-height:1.6;margin:0 0 24px;">${message}</p>
  <a href="https://africanyouthobservatory.org" style="display:inline-block;padding:12px 28px;background:#D4A017;color:#0A0A0A;font-weight:600;text-decoration:none;border-radius:8px;">Back to the platform</a>
</div></body></html>`;
}

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly service: NewsletterService) {}

  @Public()
  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe an email to the newsletter (upserts on email).' })
  subscribe(@Body() body: SubscribeDto) {
    return this.service.subscribe(body);
  }

  @Public()
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'One-click unsubscribe via the token from a briefing email.' })
  async unsubscribe(@Query('token') token: string): Promise<string> {
    const result = await this.service.unsubscribe(token);
    if (!result.ok) {
      return page(
        'Link not recognised',
        'This unsubscribe link is invalid or has already been used. If you keep receiving emails, reply to one and we\'ll remove you manually.',
      );
    }
    return page(
      'You\'ve been unsubscribed',
      `<strong>${result.email}</strong> will no longer receive the monthly youth-data briefing. You can resubscribe any time from the website.`,
    );
  }
}
