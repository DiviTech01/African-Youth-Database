import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { InsightsModule } from '../insights/insights.module';

@Module({
  // InsightsModule exports AiService, which OpsService uses for the real
  // Anthropic health probe.
  imports: [InsightsModule],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
