import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 60 * 1000; // let the DB connection settle after deploy

/**
 * Dependency-free monthly scheduler (no @nestjs/schedule needed). A daily tick
 * calls generateMonthlyDraft(), which is idempotent per calendar month via the
 * unique periodKey — so it creates exactly one DRAFT per month and emails an
 * admin to review it. It NEVER sends to subscribers; only an admin approval
 * does that.
 *
 * Render runs a single instance, so a plain setInterval is sufficient. If the
 * service ever scales out, move this to an external cron hitting
 * POST /api/newsletter/admin/campaigns/generate-monthly instead.
 */
@Injectable()
export class NewsletterScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsletterScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private bootTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly service: NewsletterService) {}

  onModuleInit() {
    this.bootTimer = setTimeout(() => this.tick(), BOOT_DELAY_MS);
    this.timer = setInterval(() => this.tick(), DAY_MS);
    this.logger.log('Monthly briefing scheduler armed (daily idempotent check)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.bootTimer) clearTimeout(this.bootTimer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.service.generateMonthlyDraft();
    } catch (e) {
      this.logger.error(`monthly draft tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
