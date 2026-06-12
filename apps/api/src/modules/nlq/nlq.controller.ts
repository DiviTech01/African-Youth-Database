import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NlqService } from './nlq.service';
import { AiService } from '../insights/ai.service';
import { NlqQueryDto } from './nlq.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('nlq')
@Controller('nlq')
export class NlqController {
  constructor(
    private readonly nlqService: NlqService,
    private readonly aiService: AiService,
  ) {}

  @Public()
  // Anthropic-backed (real cost): cap to 10/min and 300/day per IP.
  @Throttle({ medium: { ttl: 60000, limit: 10 }, long: { ttl: 86_400_000, limit: 300 } })
  @Post('query')
  @ApiOperation({
    summary: 'Ask a natural language question about African youth data',
    description: 'Submit a question in plain English and receive a data-backed answer with visualization suggestions.',
  })
  async query(@Body() dto: NlqQueryDto) {
    const startTime = Date.now();

    // Use the upgraded AI service with tool use
    const result = await this.aiService.answerQuestion(dto.question, {
      countryId: dto.countryId,
      includeVisualization: true,
      language: dto.language,
    });

    return {
      question: dto.question,
      answer: result.answer,
      keyFindings: result.keyFindings,
      dataCitations: result.dataCitations,
      visualization: result.visualization,
      followUpQuestions: result.followUpQuestions,
      confidence: result.confidence,
      dataAvailability: result.dataAvailability,
      source: result.source,
      processingTime: (Date.now() - startTime) / 1000,
    };
  }

  /**
   * Legacy alias for frontend compatibility
   */
  @Public()
  @Throttle({ medium: { ttl: 60000, limit: 10 }, long: { ttl: 86_400_000, limit: 300 } })
  @Post('query/natural-language')
  @ApiOperation({ summary: 'Alias — natural language query (frontend compat)' })
  async queryAlias(@Body() dto: NlqQueryDto) {
    return this.query(dto);
  }
}
