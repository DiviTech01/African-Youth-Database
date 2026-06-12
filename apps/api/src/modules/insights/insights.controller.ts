import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InsightsService } from './insights.service';
import { CountryNarrativeService } from './country-narrative.service';
import { AiService } from './ai.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('insights')
@Controller('insights')
// AI-generated narratives are Anthropic-backed (real cost): 20/min and 500/day per IP.
@Throttle({ medium: { ttl: 60000, limit: 20 }, long: { ttl: 86_400_000, limit: 500 } })
export class InsightsController {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly narrativeService: CountryNarrativeService,
    private readonly aiService: AiService,
  ) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Check AI service availability' })
  async getStatus() {
    return {
      aiAvailable: await this.aiService.isAvailable(),
      model: this.aiService.getModel(),
    };
  }

  @Public()
  @Get('country/:countryId')
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiOperation({ summary: 'Get AI-generated insights for a country' })
  getCountryInsights(@Param('countryId') countryId: string) {
    return this.insightsService.generateCountryInsights(countryId);
  }

  @Public()
  @Get('trend/:indicatorId/:countryId')
  @ApiParam({ name: 'indicatorId', description: 'Indicator ID' })
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiOperation({ summary: 'Get trend analysis for an indicator and country' })
  getTrendAnalysis(
    @Param('indicatorId') indicatorId: string,
    @Param('countryId') countryId: string,
  ) {
    return this.insightsService.generateTrendAnalysis(indicatorId, countryId);
  }

  @Public()
  @Get('anomalies')
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiOperation({ summary: 'Detect statistical anomalies across all countries' })
  getAnomalies(@Query('year') year?: number) {
    return this.insightsService.generateAnomalies(year ? +year : undefined);
  }

  @Public()
  @Get('correlations')
  @ApiQuery({ name: 'themeId', required: false })
  @ApiOperation({ summary: 'Find indicator correlations (within a theme or cross-theme)' })
  getCorrelations(@Query('themeId') themeId?: string) {
    return this.insightsService.generateCorrelations(themeId);
  }

  @Public()
  @Get('narrative/:countryId')
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiOperation({ summary: 'Get full country profile narrative' })
  getNarrative(@Param('countryId') countryId: string) {
    return this.narrativeService.generateNarrative(countryId);
  }

  /**
   * Alias: frontend calls GET /insights/:countryId directly.
   * Placed LAST so specific routes (status, anomalies, correlations, trend, narrative) match first.
   */
  @Public()
  @Get(':countryId')
  @ApiOperation({ summary: 'Alias — get AI insights for a country (frontend compat)' })
  getCountryInsightsAlias(@Param('countryId') countryId: string) {
    return this.insightsService.generateCountryInsights(countryId);
  }
}
