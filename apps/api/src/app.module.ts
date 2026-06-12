import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RlsMiddleware } from './common/middleware/rls.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { CountriesModule } from './modules/countries/countries.module';
import { ThemesModule } from './modules/themes/themes.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { DataModule } from './modules/data/data.module';
import { YouthIndexModule } from './modules/youth-index/youth-index.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlatformModule } from './modules/platform/platform.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { CompareModule } from './modules/compare/compare.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { ExportModule } from './modules/export/export.module';
import { InsightsModule } from './modules/insights/insights.module';
import { NlqModule } from './modules/nlq/nlq.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { PolicyMonitorModule } from './modules/policy-monitor/policy-monitor.module';
import { ExpertDirectoryModule } from './modules/expert-directory/expert-directory.module';
import { LiveFeedModule } from './modules/live-feed/live-feed.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmbedModule } from './modules/embed/embed.module';
import { DataUploadModule } from './modules/data-upload/data-upload.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { CountryReportsModule } from './modules/country-reports/country-reports.module';
import { ContentModule } from './modules/content/content.module';
import { InsightReportsModule } from './modules/insight-reports/insight-reports.module';
import { MailModule } from './modules/mail/mail.module';
import { CacheService } from './common/cache.service';

@Global()
@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
      {
        // Daily bucket — used to cap expensive AI/LLM endpoints per IP as
        // defense-in-depth against cost-amplification. Routes opt in via
        // @Throttle({ long: { ... } }); other routes are unaffected because
        // they don't set a tighter long limit (this default is generous).
        name: 'long',
        ttl: 86_400_000,
        limit: 10_000,
      },
    ]),

    // Core
    PrismaModule,

    // Data modules
    CountriesModule,
    ThemesModule,
    IndicatorsModule,
    DataModule,

    // Analysis
    YouthIndexModule,
    CompareModule,
    InsightsModule,
    InsightReportsModule,
    NlqModule,
    AiChatModule,

    // Features
    PolicyMonitorModule,
    ExpertDirectoryModule,
    DashboardsModule,
    LiveFeedModule,
    SearchModule,
    EmbedModule,
    ExportModule,

    // Email
    MailModule,

    // Auth & Admin
    AuthModule,
    AdminModule,
    DataUploadModule,
    DocumentsModule,
    CountryReportsModule,
    ContentModule,

    // Platform
    PlatformModule,
    NewsletterModule,
  ],
  providers: [
    CacheService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [CacheService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RlsMiddleware).forRoutes('*');
  }
}
