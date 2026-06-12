import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AiChatService } from './ai-chat.service';
import { Public } from '../auth/decorators/public.decorator';

// The global ValidationPipe runs with `whitelist + forbidNonWhitelisted`, which
// silently drops any DTO field that isn't decorated with a class-validator
// rule and then rejects the request as "property … should not exist". So
// every accepted field needs a decorator below — without them, the AI chat
// endpoint returned 400 even on well-formed payloads.
class ChatHistoryItem {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

class AiChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItem)
  history?: ChatHistoryItem[];
}

@ApiTags('ai')
@Controller('ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Public()
  // Anthropic-backed (real cost): cap to 10/min and 300/day per IP.
  @Throttle({ medium: { ttl: 60000, limit: 10 }, long: { ttl: 86_400_000, limit: 300 } })
  @Post('chat')
  @ApiOperation({
    summary: 'Chat with the African Youth Observatory AI assistant',
    description:
      'Send a message and receive an AI-powered response with optional data visualizations. Falls back to rule-based NLQ if the AI service is unavailable.',
  })
  async chat(@Body() dto: AiChatDto) {
    return this.aiChatService.chat(dto.message, dto.context, dto.history);
  }
}
