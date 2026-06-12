import {
  Controller, Post, Get, Delete, Param, Body, Req, Res,
  UseInterceptors, UploadedFile, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { DataUploadService } from './data-upload.service';
import { UploadConfigDto } from './data-upload.dto';
import { BadRequestException } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Only CSV / Excel uploads are expected here. The parser would fail on other
// types anyway, but rejecting up front avoids buffering junk and gives a clear
// error. Some browsers send octet-stream for .xlsx, so we also allow that when
// the extension matches.
const SPREADSHEET_MIMES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);
const spreadsheetUpload = {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) => {
    const extOk = /\.(csv|xls|xlsx)$/i.test(file.originalname || '');
    if (SPREADSHEET_MIMES.has(file.mimetype) && extOk) return cb(null, true);
    cb(new BadRequestException(`Unsupported file type: ${file.mimetype} (${file.originalname}). Upload a CSV or XLSX.`), false);
  },
};

@ApiTags('data-upload')
@ApiBearerAuth()
@Controller('data-upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataUploadController {
  constructor(private readonly uploadService: DataUploadService) {}

  @Post('file')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', spreadsheetUpload))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a CSV or XLSX file for import preview' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('config') configJson: string,
    @Req() req: Request,
  ) {
    const config: UploadConfigDto = JSON.parse(configJson);
    const userId = (req as any).user?.id || 'anonymous';
    const job = await this.uploadService.uploadFile(file, userId, config);
    // Return without parsedValues (too large for response)
    const { parsedValues, ...rest } = job as any;
    return rest;
  }

  @Post('ayims-template')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', spreadsheetUpload))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload an AYIMS Data Entry Template (e.g. Angola_AYIMS_Template_v1.xlsx). Country is auto-detected from the filename or sheet metadata. Generates a preview job that can be committed via /commit/:jobId, same as the generic uploader.',
  })
  async uploadAyims(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || 'anonymous';
    const job = await this.uploadService.uploadAyimsTemplate(file, userId, {
      countryId: body?.countryId,
      source: body?.source,
      notes: body?.notes,
    });
    const { parsedValues, ...rest } = job as any;
    return rest;
  }

  @Get('preview/:jobId')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'Preview parsed data before committing' })
  getPreview(@Param('jobId') jobId: string, @Req() req: Request) {
    const userId = (req as any).user?.id || '';
    return this.uploadService.getPreview(jobId, userId);
  }

  @Post('commit/:jobId')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'Commit previewed data to the database. Dispatches to indicator or policy commit based on jobId prefix.' })
  async commitJob(@Param('jobId') jobId: string, @Req() req: Request) {
    const userId = (req as any).user?.id || '';
    if (jobId.startsWith('pol_')) return this.uploadService.commitPoliciesJob(jobId, userId);
    return this.uploadService.commitJob(jobId, userId);
  }

  @Get('commit-status/:jobId')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({
    summary: 'Live progress for an in-flight commit (current/total/percent/etaMs). Poll while waiting on /commit/:jobId.',
  })
  getCommitStatus(@Param('jobId') jobId: string, @Req() req: Request) {
    const userId = (req as any).user?.id || '';
    return this.uploadService.getCommitStatus(jobId, userId);
  }

  @Post('policies-database')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', spreadsheetUpload))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload the African National Youth Policies Database (CSV/XLSX). Each country row is scored across 30 policy instruments using the AYC Composite Policy Index scoring rules (status × recency, with legal-marker bonus). Commit via /commit/:jobId.',
  })
  async uploadPolicies(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || 'anonymous';
    const job = await this.uploadService.uploadPoliciesDatabase(file, userId, {
      source: body?.source,
      notes: body?.notes,
    });
    // Limit records returned to keep payload manageable.
    return {
      ...job,
      records: job.records.slice(0, 50),
      recordCount: job.records.length,
    };
  }

  @Get('preview-policies/:jobId')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'Full preview of a previewed policies job (all parsed records).' })
  getPolicyPreview(@Param('jobId') jobId: string, @Req() req: Request) {
    const userId = (req as any).user?.id || '';
    return this.uploadService.getPolicyPreview(jobId, userId);
  }

  @Get('history')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'List past uploads by this user (admin sees all)' })
  getHistory(@Req() req: Request) {
    const user = (req as any).user;
    return this.uploadService.getHistory(user?.id || '', user?.role === 'ADMIN');
  }

  @Get('history/:id')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'Details of a specific upload' })
  getHistoryDetail(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.uploadService.getHistoryDetail(id, user?.id || '', user?.role === 'ADMIN');
  }

  @Delete('history/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete an upload record (admin only)' })
  deleteUpload(@Param('id') id: string) {
    return this.uploadService.deleteUpload(id);
  }

  @Get('needed')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'List data gaps — what data is missing and needed' })
  getNeeded() {
    return this.uploadService.getDataNeeds();
  }

  @Get('indicators')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'List all indicators with expected format for column mapping' })
  getIndicators() {
    return this.uploadService.getIndicatorsForMapping();
  }

  @Get('templates')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'List available upload template formats' })
  getTemplates() {
    return this.uploadService.getTemplates();
  }

  @Get('templates/:slug')
  @Roles('CONTRIBUTOR', 'ADMIN')
  @ApiOperation({ summary: 'Download a CSV template with pre-filled country names' })
  async downloadTemplate(@Param('slug') slug: string, @Res() res: Response) {
    const csv = await this.uploadService.downloadTemplate(slug);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-template.csv"`);
    res.send(csv);
  }
}
