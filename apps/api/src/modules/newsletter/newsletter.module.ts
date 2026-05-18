import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { NewsletterAdminController } from './newsletter-admin.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterScheduler } from './newsletter.scheduler';

// MailService (global MailModule) and PrismaService (global PrismaModule) are
// injected without explicit imports here.
@Module({
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService, NewsletterScheduler],
})
export class NewsletterModule {}
