import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NewsletterService } from './newsletter.service';
import { CreateCampaignDto, UpdateCampaignDto, TestEmailDto } from './newsletter.dto';

/**
 * Admin-only newsletter operations. Guarded explicitly with
 * JwtAuthGuard + RolesGuard (the safe pattern used by content/data-upload),
 * because the API has no global auth guard. Briefings only reach subscribers
 * after an admin hits `approve`.
 */
@ApiTags('newsletter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('newsletter/admin')
export class NewsletterAdminController {
  constructor(private readonly service: NewsletterService) {}

  @Get('subscribers/stats')
  @ApiOperation({ summary: 'Subscriber counts by status.' })
  subscriberStats() {
    return this.service.subscriberStats();
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List all briefing campaigns (newest first).' })
  list() {
    return this.service.listCampaigns();
  }

  @Post('campaigns/generate-monthly')
  @ApiOperation({ summary: 'Manually generate this month\'s draft (idempotent per month).' })
  generateMonthly() {
    return this.service.generateMonthlyDraft();
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get one campaign.' })
  get(@Param('id') id: string) {
    return this.service.getCampaign(id);
  }

  @Get('campaigns/:id/preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Render the exact HTML subscribers will receive.' })
  preview(@Param('id') id: string) {
    return this.service.previewHtml(id);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a draft briefing.' })
  create(@Body() dto: CreateCampaignDto, @Request() req: any) {
    return this.service.createDraft(dto, req.user?.id);
  }

  @Put('campaigns/:id')
  @ApiOperation({ summary: 'Edit a draft / pending briefing.' })
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.service.updateDraft(id, dto);
  }

  @Post('campaigns/:id/submit')
  @ApiOperation({ summary: 'Submit a draft for admin approval (emails an admin).' })
  submit(@Param('id') id: string) {
    return this.service.submitForApproval(id);
  }

  @Post('campaigns/:id/approve')
  @ApiOperation({ summary: 'Approve & send to all subscribers. The only send gate.' })
  approve(@Param('id') id: string, @Request() req: any) {
    return this.service.approve(id, req.user?.id);
  }

  @Post('campaigns/:id/cancel')
  @ApiOperation({ summary: 'Discard a campaign (not allowed once sending/sent).' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post('campaigns/:id/test')
  @ApiOperation({ summary: 'Send a one-off test of this campaign to an email.' })
  test(@Param('id') id: string, @Body() dto: TestEmailDto) {
    return this.service.sendTest(id, dto.email);
  }
}
