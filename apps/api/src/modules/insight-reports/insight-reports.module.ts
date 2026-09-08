import { Module } from '@nestjs/common';
import { InsightReportsController } from './insight-reports.controller';
import { InsightReportsService } from './insight-reports.service';
import { ReportStoreService } from './report-store.service';
import { InsightsModule } from '../insights/insights.module'; // AiService, AiContextService
import { NewsletterModule } from '../newsletter/newsletter.module'; // NewsletterService
import { ContentModule } from '../content/content.module'; // R2Service, for report persistence

// PrismaService + CacheService are global. AiService/AiContextService come from
// InsightsModule; NewsletterService (broadcastAdHoc) from NewsletterModule;
// R2Service — which ReportStoreService uses to survive a restart — from ContentModule.
@Module({
  imports: [InsightsModule, NewsletterModule, ContentModule],
  controllers: [InsightReportsController],
  providers: [InsightReportsService, ReportStoreService],
})
export class InsightReportsModule {}
