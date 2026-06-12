import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from '../content/r2.service';
import { DocumentUploadDto, DocumentTypeName, PkpbExtractedSummary } from './documents.dto';

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/html', // PKPB country reports often arrive as HTML; we render them inline + offer print-to-PDF.
  'application/xhtml+xml',
]);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async upload(file: Express.Multer.File, dto: DocumentUploadDto, uploadedById: string | null) {
    if (!file) throw new BadRequestException('No file received');
    if (!ACCEPTED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Accepted: PDF, DOCX, DOC, PPTX, PPT, TXT.`,
      );
    }

    if (dto.type === 'PKPB_REPORT' && !dto.countryId) {
      throw new BadRequestException('countryId is required for PKPB_REPORT uploads');
    }

    // Resolve the country reference flexibly: accepts the database cuid, ISO3,
    // ISO2 (case-insensitive), exact name, or slug ("south-africa"). The
    // frontend's hardcoded country list uses lowercase ISO2 as the id (e.g.
    // "ao", "dz"), so we need to handle that too.
    let resolvedCountryId: string | null = null;
    if (dto.countryId) {
      const country = await this.resolveCountry(dto.countryId);
      if (!country) throw new BadRequestException(`Unknown country reference: ${dto.countryId}`);
      resolvedCountryId = country.id;
    }

    let extractedText: string | null = null;
    if (file.mimetype === 'application/pdf') {
      extractedText = await this.extractPdfText(file.buffer);
    } else if (file.mimetype === 'text/plain') {
      extractedText = file.buffer.toString('utf-8').slice(0, 200_000);
    } else if (file.mimetype === 'text/html' || file.mimetype === 'application/xhtml+xml') {
      // Strip script/style blocks first, then drop all remaining tags. Crude but
      // good enough to give the AI assistant + search a body of indexable text.
      const raw = file.buffer.toString('utf-8');
      const stripped = raw
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      extractedText = stripped.slice(0, 200_000);
    }

    let extractedSummary: PkpbExtractedSummary | null = null;
    if (dto.extractedSummary) {
      try {
        const parsed = JSON.parse(dto.extractedSummary);
        if (parsed && typeof parsed === 'object') extractedSummary = parsed;
      } catch {
        throw new BadRequestException('extractedSummary is not valid JSON');
      }
    }

    const { key } = await this.r2.uploadFile(file, this.prefixFor(dto.type, dto.countryId));

    const startedAt = Date.now();
    const created = await this.prisma.document.create({
      data: {
        type: dto.type as any,
        title: dto.title,
        description: dto.description ?? null,
        countryId: resolvedCountryId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storageKey: key,
        extractedText,
        extractedSummary: extractedSummary as any,
        source: dto.source ?? null,
        edition: dto.edition ?? null,
        year: dto.year ?? null,
        uploadedById,
      },
      include: { country: { select: { id: true, name: true, isoCode3: true } } },
    });

    // Persistent audit row so this upload shows in the History tab.
    try {
      await this.prisma.uploadAudit.create({
        data: {
          kind: 'DOCUMENT',
          fileName: file.originalname,
          fileSize: file.size,
          status: 'SUCCESS',
          rowsAffected: 1,
          countryId: resolvedCountryId,
          documentId: created.id,
          source: dto.source ?? null,
          notes: dto.description ?? null,
          uploadedById: uploadedById && uploadedById !== 'anonymous' ? uploadedById : null,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (err) {
      this.logger.warn(`[upload-audit] document audit row failed: ${(err as Error).message}`);
    }

    return this.serialize(created);
  }

  async list(filter: { countryId?: string; type?: DocumentTypeName; limit?: number }) {
    const docs = await this.prisma.document.findMany({
      where: {
        countryId: filter.countryId,
        type: filter.type as any,
        status: 'PUBLISHED',
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 100,
      include: { country: { select: { id: true, name: true, isoCode3: true } } },
    });
    return docs.map((d) => this.serialize(d, { withText: false }));
  }

  async getById(id: string) {
    // Public endpoint: only published documents are readable. Looking up by
    // status as part of the unique-ish filter prevents IDOR on DRAFT/unpublished
    // reports via cuid enumeration. Admins go through the admin module instead.
    const doc = await this.prisma.document.findFirst({
      where: { id, status: 'PUBLISHED' },
      include: { country: { select: { id: true, name: true, isoCode3: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return this.serialize(doc);
  }

  /**
   * Latest published PKPB report(s) for a country. The page renders the HTML
   * version inline (with animations) and routes the Download button to the PDF
   * when one is on file. We return both formats so the frontend can decide:
   *
   *   - HTML only           → render inline + offer the HTML for download
   *   - PDF only            → show "HTML coming soon" placeholder + offer PDF
   *   - HTML + PDF on file  → render HTML inline, Download button serves the PDF
   *   - Neither             → "Coming soon" placeholder (no upload yet)
   *
   * `document` stays for backward compatibility — it's the freshest of any
   * format and matches the previous shape of this endpoint.
   */
  async getLatestPkpbForCountry(countryRef: string) {
    const country = await this.resolveCountry(countryRef);
    if (!country) throw new NotFoundException(`Country not found: ${countryRef}`);

    const docs = await this.prisma.document.findMany({
      where: { countryId: country.id, type: 'PKPB_REPORT', status: 'PUBLISHED' },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: { country: { select: { id: true, name: true, isoCode3: true } } },
    });

    const isHtml = (d: { mimeType: string | null; originalFilename: string }) =>
      /text\/html|xhtml/i.test(d.mimeType ?? '') || /\.(html?|xhtml)$/i.test(d.originalFilename);
    const isPdf = (d: { mimeType: string | null; originalFilename: string }) =>
      /application\/pdf/i.test(d.mimeType ?? '') || /\.pdf$/i.test(d.originalFilename);

    const html = docs.find(isHtml) ?? null;
    const pdf = docs.find(isPdf) ?? null;
    const latest = docs[0] ?? null;

    return {
      country,
      document: latest ? this.serialize(latest) : null,
      htmlDocument: html ? this.serialize(html) : null,
      pdfDocument: pdf ? this.serialize(pdf) : null,
    };
  }

  async getDownloadStream(id: string) {
    // Public download path — only stream published files. Prevents enumerating
    // and pulling DRAFT/unpublished report files by cuid (IDOR).
    const doc = await this.prisma.document.findFirst({ where: { id, status: 'PUBLISHED' } });
    if (!doc) throw new NotFoundException('Document not found');
    const obj = await this.r2.getObject(doc.storageKey);
    return { ...obj, document: doc };
  }

  async remove(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    try {
      await this.r2.deleteObject(doc.storageKey);
    } catch (err) {
      this.logger.warn(`Failed to delete R2 object ${doc.storageKey}: ${(err as Error).message}`);
    }
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }

  private prefixFor(type: DocumentTypeName, countryId?: string): string {
    const base = {
      PKPB_REPORT: 'documents/pkpb',
      COUNTRY_REPORT: 'documents/country-reports',
      POLICY_DOCUMENT: 'documents/policy',
      RESEARCH_PAPER: 'documents/research',
      OTHER: 'documents/other',
    }[type];
    return countryId ? `${base}/${countryId}` : base;
  }

  // Common informal aliases that contributors put in filenames or query
  // strings — DRC, CAR, Cameroun, Sao Tome (no diacritics), Swaziland (the
  // pre-2018 name for Eswatini), etc. Each maps to the ISO3 of the canonical
  // country in our DB. Keep this list in sync with the same map in the
  // frontend's DataUpload.tsx so filename auto-detect and ?country=… query
  // strings resolve to the same row.
  private static readonly COUNTRY_ALIASES: Record<string, string> = {
    'drc': 'COD', 'rdc': 'COD', 'dr congo': 'COD', 'drcongo': 'COD',
    'congo kinshasa': 'COD', 'congo drc': 'COD',
    'congo brazzaville': 'COG',
    'car': 'CAF', 'rca': 'CAF',
    'cameroun': 'CMR',
    'sao tome': 'STP', 'sao tome and principe': 'STP', 'stp': 'STP',
    'swaziland': 'SWZ',
    'ivory coast': 'CIV', 'cote d ivoire': 'CIV', 'cote divoire': 'CIV',
    'cape verde': 'CPV',
    'united republic of tanzania': 'TZA',
  };

  private async resolveCountry(ref: string) {
    // Accept id, ISO3, ISO2 (case-insensitive), exact name, slug-style
    // ("south-africa" → "South Africa"), and a handful of informal aliases
    // (DRC, CAR, Cameroun, Sao Tome, Swaziland, etc.). We strip diacritics
    // and normalise separators before matching aliases so a query like
    // "São_Tomé" still resolves cleanly. The frontend's hardcoded country
    // list sends lowercase ISO2 (e.g. "ao", "dz") as the id — this resolver
    // matches that path too.
    //
    // Only select fields we can safely serialise to JSON (Country.population
    // and youthPopulation are BigInt in Prisma; default JSON.stringify chokes).
    const decoded = decodeURIComponent(ref).trim();
    const slugAsName = decoded.replace(/-/g, ' ');

    // Alias resolution — diacritic-stripped, lowercased, separator-normalised.
    const normalised = decoded
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const aliasIso3 = DocumentsService.COUNTRY_ALIASES[normalised];

    return this.prisma.country.findFirst({
      where: {
        OR: [
          { id: decoded },
          { isoCode3: decoded.toUpperCase() },
          { isoCode2: decoded.toUpperCase() },
          { name: { equals: decoded, mode: 'insensitive' } },
          { name: { equals: slugAsName, mode: 'insensitive' } },
          ...(aliasIso3 ? [{ isoCode3: aliasIso3 }] : []),
        ],
      },
      select: { id: true, name: true, isoCode2: true, isoCode3: true, region: true },
    });
  }

  private serialize(doc: any, opts: { withText?: boolean } = {}) {
    const withText = opts.withText !== false;
    return {
      id: doc.id,
      type: doc.type,
      title: doc.title,
      description: doc.description,
      country: doc.country,
      countryId: doc.countryId,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      source: doc.source,
      edition: doc.edition,
      year: doc.year,
      status: doc.status,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      extractedSummary: doc.extractedSummary ?? null,
      extractedText: withText ? doc.extractedText : undefined,
      downloadUrl: `/api/documents/${doc.id}/download`,
    };
  }

  /**
   * Best-effort PDF text extraction. We dynamically import pdf-parse so the
   * server can boot without it (and so the CJS module's startup quirks don't
   * fire at module-load time).
   */
  private async extractPdfText(buffer: Buffer): Promise<string | null> {
    try {
      const mod = await import('pdf-parse');
      const pdfParse: any = (mod as any).default ?? mod;
      const data = await pdfParse(buffer);
      const text: string = data?.text ?? '';
      return text.slice(0, 200_000); // cap to ~200KB of text
    } catch (err) {
      this.logger.warn(`PDF text extraction failed: ${(err as Error).message}`);
      return null;
    }
  }
}
