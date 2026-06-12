import { Module } from '@nestjs/common';
import { InsightReportsController } from './insight-reports.controller';
import { InsightReportsService } from './insight-reports.service';
import { InsightsModule } from '../insights/insights.module'; // AiService, AiContextService
import { NewsletterModule } from '../newsletter/newsletter.module'; // NewsletterService

// PrismaService + CacheService are global. AiService/AiContextService come from
// InsightsModule; NewsletterService (broadcastAdHoc) from NewsletterModule.
@Module({
  imports: [InsightsModule, NewsletterModule],
  controllers: [InsightReportsController],
  providers: [InsightReportsService],
})
export class InsightReportsModule {}
