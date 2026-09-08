import {
  Controller, Post, Get, Body, Param, Query, Res, UseGuards, BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { IsIn, IsOptional, IsString, IsInt } from 'class-validator';
import { InsightReportsService, ReportScope } from './insight-reports.service';
import { ReportFormat } from './report-document.model';
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

const REPORT_FORMATS: ReportFormat[] = ['html', 'pdf', 'pptx', 'xlsx'];

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
  @ApiOperation({ summary: 'Fetch a previously generated report, including its structured document.' })
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id/download')
  @Public()
  @ApiQuery({ name: 'format', required: false, enum: REPORT_FORMATS })
  @ApiOperation({
    summary: 'Download a generated report as HTML, PDF, PowerPoint or Excel. Defaults to HTML.',
  })
  async download(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    // An unknown ?format is a client mistake, not a reason to silently hand back
    // HTML under a .pptx filename.
    const requested = (format ?? 'html').toLowerCase();
    if (!REPORT_FORMATS.includes(requested as ReportFormat)) {
      throw new BadRequestException(
        `Unsupported format "${format}". Use one of: ${REPORT_FORMATS.join(', ')}.`,
      );
    }

    const { filename, mime, body } = await this.service.render(id, requested as ReportFormat);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(body.length));
    res.end(body);
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
