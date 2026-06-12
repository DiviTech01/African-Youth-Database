import {
  Controller, Post, Get, Delete, Param, Query, Body, Req, Res,
  UseInterceptors, UploadedFile, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Readable } from 'stream';
import { DocumentsService } from './documents.service';
import { DocumentUploadDto, DocumentTypeName, DOCUMENT_TYPES } from './documents.dto';
import { injectPkpbAnimations } from './pkpb-animations';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
}

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CONTRIBUTOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a report or document. Routes to country PKPB page when type=PKPB_REPORT.' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const dto: DocumentUploadDto = {
      type: body.type as DocumentTypeName,
      title: body.title,
      description: body.description,
      countryId: body.countryId,
      source: body.source,
      edition: body.edition,
      year: body.year ? parseInt(body.year, 10) : undefined,
      extractedSummary: body.extractedSummary,
    };
    const userId = (req as any).user?.id ?? null;
    return this.documents.upload(file, dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List published documents, filterable by country and type.' })
  @ApiQuery({ name: 'countryId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: DOCUMENT_TYPES })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Query('countryId') countryId?: string,
    @Query('type') type?: DocumentTypeName,
    @Query('limit') limit?: string,
  ) {
    return this.documents.list({
      countryId,
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('by-country/:countryRef/pkpb')
  @ApiOperation({ summary: 'Latest PKPB report for a country (id, ISO3, or name).' })
  pkpb(@Param('countryRef') countryRef: string) {
    return this.documents.getLatestPkpbForCountry(countryRef);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single document including extracted text.' })
  getOne(@Param('id') id: string) {
    return this.documents.getById(id);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Stream the original file from storage. Pass ?disposition=inline to embed (e.g. iframe preview).',
  })
  @ApiQuery({ name: 'disposition', required: false, enum: ['attachment', 'inline'] })
  async download(
    @Param('id') id: string,
    @Query('disposition') disposition: 'attachment' | 'inline' | undefined,
    @Res() res: Response,
  ) {
    const { body, contentType, contentLength, document } = await this.documents.getDownloadStream(id);
    const safeName = document.originalFilename.replace(/[^\w.\- ]+/g, '_');
    const mode = disposition === 'inline' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${mode}; filename="${safeName}"`);

    // For inline HTML PKPB renders, splice in our scroll-reveal/counter/bar-fill
    // animation block before <body>. Direct downloads stay byte-pure so the
    // file the user saves matches what the contributor uploaded.
    const isHtml = /^text\/html\b/i.test(contentType) || /^application\/xhtml\+xml\b/i.test(contentType);
    const isPkpb = document.type === 'PKPB_REPORT';
    if (mode === 'inline' && isHtml && isPkpb) {
      const raw = await streamToString(body);
      const enriched = injectPkpbAnimations(raw);
      res.setHeader('Content-Type', contentType);
      res.send(enriched); // Length recomputed by Express; the original Content-Length is no longer accurate.
      return;
    }

    // Defense-in-depth against stored XSS: any HTML we serve inline that is NOT
    // a curated PKPB report gets sandboxed so embedded scripts can't run in our
    // origin. PKPB reports are admin-curated and need their injected animation
    // scripts, so they're exempt (handled in the branch above).
    if (mode === 'inline' && isHtml) {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src data: https:; style-src 'unsafe-inline'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    body.pipe(res);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a document (admin only). Removes the R2 object too.' })
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }
}
