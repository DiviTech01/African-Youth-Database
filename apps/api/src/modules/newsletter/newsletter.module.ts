import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { NewsletterAdminController } from './newsletter-admin.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterScheduler } from './newsletter.scheduler';
import { ContentModule } from '../content/content.module'; // for R2Service

// MailService (global MailModule) and PrismaService (global PrismaModule) are
// injected without explicit imports here. R2Service comes from ContentModule.
@Module({
  imports: [ContentModule],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService, NewsletterScheduler],
})
export class NewsletterModule {}
