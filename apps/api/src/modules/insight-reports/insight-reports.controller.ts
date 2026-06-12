import {
  Controller, Post, Get, Body, Param, Query, Res, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { IsIn, IsOptional, IsString, IsInt } from 'class-validator';
import { InsightReportsService, ReportScope } from './insight-reports.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

class GenerateReportDto {
  @IsIn(['continental', 'country', 'theme'])
  scope: ReportScope;

  @IsOptional() @IsString()
  countryId?: string;

  @IsOptional() @IsString()
  themeId?: string;

  @IsOptional() @IsInt()
  year?: number;
}

class SendReportDto {
  @IsIn(['subscribers', 'users', 'all'])
  audience: 'subscribers' | 'users' | 'all';
}

@ApiTags('insight-reports')
@Controller('insight-reports')
export class InsightReportsController {
  constructor(private readonly service: InsightReportsService) {}

  @Post('generate')
  @Public()
  // Anthropic-backed (real cost): 6/min and 60/day per IP.
  @Throttle({ medium: { ttl: 60000, limit: 6 }, long: { ttl: 86_400_000, limit: 60 } })
  @ApiOperation({
    summary: 'Generate a data-backed insights report (continental, country, or theme) with Claude.',
  })
  generate(@Body() dto: GenerateReportDto) {
    return this.service.generate(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Fetch a previously generated report (cached, 24h).' })
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id/download')
  @Public()
  @ApiQuery({ name: 'format', required: false, enum: ['html'] })
  @ApiOperation({ summary: 'Download a generated report as a standalone, printable HTML document.' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { filename, html } = await this.service.renderDownloadHtml(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  }

  @Post(':id/send')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: email a generated report to an audience (subscribers | users | all). Reuses the newsletter dispatch pipeline.',
  })
  send(@Param('id') id: string, @Body() dto: SendReportDto) {
    return this.service.send(id, dto.audience);
  }
}
