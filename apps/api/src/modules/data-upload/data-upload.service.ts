import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ayimsMappingFile = require('./ayims-template-mapping.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const policiesConfigFile = require('./policies-database-config.json');

// ── Types ────────────────────────────────────────────────────────────────────

interface ColumnMapping {
  column: string;
  indicatorSlug: string;
  year?: number;
  gender?: 'MALE' | 'FEMALE' | 'TOTAL';
  ageGroup?: string;
  transform?: 'none' | 'multiply_1000' | 'divide_100' | 'invert';
}

interface UploadConfig {
  sheetName?: string;
  headerRow?: number;
  skipRows?: number;
  countryColumn: string;
  countryFormat: 'name' | 'iso2' | 'iso3';
  mappings: ColumnMapping[];
  source: string;
  notes?: string;
  year?: number;
}

interface CommitProgress {
  current: number;
  total: number;
  percent: number;
  startedAt: number;
  etaMs: number | null;
}

interface UploadJob {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: 'preview' | 'committing' | 'committed' | 'failed' | 'expired';
  config: UploadConfig;
  commitProgress?: CommitProgress;
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    countriesMatched: number;
    countriesUnmatched: string[];
    indicatorsMapped: number;
    valuesTotal: number;
    valuesByIndicator: { slug: string; name: string; count: number }[];
  };
  preview: {
    headers: string[];
    rows: any[][];
    mappedPreview: {
      country: string;
      indicator: string;
      year: number;
      value: number;
      gender: string;
      status: 'valid' | 'warning' | 'error';
      message?: string;
    }[];
  };
  errors: { row: number; column: string; message: string; severity: 'warning' | 'error' }[];
  parsedValues?: {
    countryId: string;
    indicatorId: string;
    year: number;
    value: number;
    gender: import('@prisma/client').GenderType;
    ageGroup: string;
    source: string;
  }[];
  result?: { inserted: number; skipped: number; errors: number; duration: number };
}

// ── Country name normalization ───────────────────────────────────────────────

const COUNTRY_ALIASES: Record<string, string> = {
  'cape verde': 'Cabo Verde',
  'ivory coast': "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  'swaziland': 'Eswatini',
  'dr congo': 'DR Congo',
  'democratic republic of the congo': 'DR Congo',
  'democratic republic of congo': 'DR Congo',
  'drc': 'DR Congo',
  'republic of the congo': 'Congo',
  'republic of congo': 'Congo',
  'congo republic': 'Congo',
  'the gambia': 'Gambia',
  'guinea bissau': 'Guinea-Bissau',
  'sao tome and principe': 'São Tomé and Príncipe',
  'são tomé & príncipe': 'São Tomé and Príncipe',
};

// ── AYIMS template column spec ───────────────────────────────────────────────

interface AyimsColumnSpec {
  slug?: string;
  gender?: 'MALE' | 'FEMALE' | 'TOTAL';
  ageGroup?: string;
  transform?: 'none' | 'multiply_1000' | 'divide_100' | 'invert';
  skip?: boolean;
  skipReason?: string;
}

/**
 * Pull country from a filename like "Angola_AYIMS_Template_v1.xlsx" → Angola.
 * Falls back to alphabetic prefix before the first underscore.
 */
function inferCountryFromFilename(
  filename: string,
  countryByKey: Map<string, { id: string; name: string }>,
): { id: string; name: string } | undefined {
  const base = filename.replace(/\.[^.]+$/, '');
  const candidates = [
    base.split(/[_\-]/)[0],
    base.replace(/_AYIMS.*/i, '').replace(/_/g, ' '),
    base.replace(/[\-_]/g, ' '),
  ];
  for (const c of candidates) {
    const hit = countryByKey.get(c.toLowerCase().trim());
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Pull country from sheet metadata (row 1) — looks for "ANGOLA" / "ISO: AGO".
 */
function inferCountryFromMetadata(
  rows: any[][],
  countryByKey: Map<string, { id: string; name: string }>,
): { id: string; name: string } | undefined {
  const text = (rows[0]?.[0] ?? '') + ' ' + (rows[1]?.[0] ?? '');
  const isoMatch = text.match(/ISO:\s*([A-Z]{3})/i);
  if (isoMatch) {
    const hit = countryByKey.get(isoMatch[1].toLowerCase());
    if (hit) return hit;
  }
  // Fall back to scanning the metadata for country names.
  const upper = String(text).toUpperCase();
  for (const [key, val] of countryByKey) {
    if (key.length < 4) continue;
    if (upper.includes(key.toUpperCase())) return val;
  }
  return undefined;
}

// ── Policy database row spec (parsed from CSV/XLSX) ──────────────────────────

interface ParsedPolicyRecord {
  countryId: string;
  countryName: string;
  policyType: string;
  policyName: string;
  dimension: string;
  yearAdopted: number | null;
  status: 'active' | 'draft' | 'missing';
  hasLegalMarker: boolean;
  statusScore: number;       // 0 / 0.5 / 1
  recencyFactor: number;     // 0.2 - 1.0
  complianceScore: number;   // (statusScore + legalBonus) * recencyFactor, capped at 1.0
}

/** Detect "draft / in development" markers in cell text. */
function isDraftMarker(text: string): boolean {
  const lower = text.toLowerCase();
  return policiesConfigFile.draftMarkers.some((m: string) => lower.includes(m.toLowerCase()));
}

/** Detect strong legal anchoring (Act / Law / Constitution / Code etc.). */
function hasLegalAnchor(text: string): boolean {
  return policiesConfigFile.legalMarkers.some((m: string) => {
    const re = new RegExp('\\b' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    return re.test(text);
  });
}

/** Pick the most recent 4-digit year mentioned in the cell text. */
function extractLatestYear(text: string): number | null {
  const matches = text.match(/\b(19|20)\d{2}\b/g);
  if (!matches?.length) return null;
  return Math.max(...matches.map((m) => parseInt(m, 10)));
}

/** Map an extracted year to a recency factor per the AYC scoring spec. */
function recencyFactorFor(year: number | null): number {
  if (year === null) return policiesConfigFile._meta.recencyBands.no_year;
  if (year >= 2022) return policiesConfigFile._meta.recencyBands['2022_plus'];
  if (year >= 2018) return policiesConfigFile._meta.recencyBands['2018_2021'];
  if (year >= 2014) return policiesConfigFile._meta.recencyBands['2014_2017'];
  if (year >= 2010) return policiesConfigFile._meta.recencyBands['2010_2013'];
  return policiesConfigFile._meta.recencyBands.pre_2010;
}

// ── In-memory job store (24h expiry) ─────────────────────────────────────────

const jobStore = new Map<string, UploadJob>();
const POLICY_JOB_PREFIX = 'pol_';
const policyJobStore = new Map<string, PolicyUploadJob>();
const JOB_TTL = 24 * 60 * 60 * 1000;

interface PolicyUploadJob {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: 'preview' | 'committed' | 'failed' | 'expired';
  source: string;
  notes?: string;
  summary: {
    countriesMatched: number;
    countriesUnmatched: string[];
    policiesParsed: number;
    inPlace: number;
    drafts: number;
    missing: number;
    averageScore: number;
  };
  records: ParsedPolicyRecord[];
  errors: { row: number; column: string; message: string; severity: 'warning' | 'error' }[];
  result?: { inserted: number; updated: number; skipped: number; errors: number; duration: number };
}

function cleanExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of jobStore) {
    if (now - new Date(job.uploadedAt).getTime() > JOB_TTL) {
      jobStore.delete(id);
    }
  }
  for (const [id, job] of policyJobStore) {
    if (now - new Date(job.uploadedAt).getTime() > JOB_TTL) {
      policyJobStore.delete(id);
    }
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DataUploadService {
  constructor(private prisma: PrismaService) {}

  // ── Upload & Parse ─────────────────────────────────────────────────────────

  async uploadFile(file: Express.Multer.File, userId: string, config: UploadConfig): Promise<UploadJob> {
    cleanExpiredJobs();

    if (!file) throw new BadRequestException('No file provided');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File exceeds 10MB limit');

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      throw new BadRequestException('Only CSV, XLSX, and XLS files are accepted');
    }

    // Parse file
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = config.sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new BadRequestException(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);

    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Find header row
    let headerIdx = config.headerRow ?? 0;
    if (!config.headerRow) {
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const filledCols = (rawRows[i] || []).filter((c: any) => c !== null && c !== '').length;
        if (filledCols >= 3) { headerIdx = i; break; }
      }
    }

    const headers = (rawRows[headerIdx] || []).map((h: any) => String(h || '').trim());
    const dataStartRow = headerIdx + 1 + (config.skipRows || 0);
    const dataRows = rawRows.slice(dataStartRow).filter((r) => r && r.some((c: any) => c !== null));

    // Load countries from DB
    const dbCountries = await this.prisma.country.findMany({
      select: { id: true, name: true, isoCode2: true, isoCode3: true },
    });
    const countryMap = new Map<string, { id: string; name: string }>();
    for (const c of dbCountries) {
      countryMap.set(c.name.toLowerCase(), { id: c.id, name: c.name });
      countryMap.set(c.isoCode2.toLowerCase(), { id: c.id, name: c.name });
      countryMap.set(c.isoCode3.toLowerCase(), { id: c.id, name: c.name });
    }
    // Add aliases
    for (const [alias, real] of Object.entries(COUNTRY_ALIASES)) {
      const found = countryMap.get(real.toLowerCase());
      if (found) countryMap.set(alias, found);
    }

    // Load indicators
    const dbIndicators = await this.prisma.indicator.findMany({
      select: { id: true, slug: true, name: true, unit: true },
    });
    const indicatorMap = new Map(dbIndicators.map((i) => [i.slug, { id: i.id, name: i.name, unit: i.unit }]));

    // Find country column index
    const countryColIdx = headers.findIndex(
      (h) => h.toLowerCase() === config.countryColumn.toLowerCase(),
    );
    if (countryColIdx < 0) throw new BadRequestException(`Country column "${config.countryColumn}" not found in headers: ${headers.filter(Boolean).join(', ')}`);

    // Process rows
    const errors: UploadJob['errors'] = [];
    const parsedValues: UploadJob['parsedValues'] = [];
    const countriesMatched = new Set<string>();
    const countriesUnmatched = new Set<string>();
    const indicatorCounts = new Map<string, number>();
    let validRows = 0;
    let errorRows = 0;
    const mappedPreview: UploadJob['preview']['mappedPreview'] = [];

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const rawCountry = String(row[countryColIdx] || '').trim();
      if (!rawCountry) continue;

      const normalizedCountry = COUNTRY_ALIASES[rawCountry.toLowerCase()] || rawCountry;
      const matchKey = normalizedCountry.toLowerCase();
      const dbCountry = countryMap.get(matchKey);

      if (!dbCountry) {
        countriesUnmatched.add(rawCountry);
        errors.push({ row: rowIdx + dataStartRow + 1, column: config.countryColumn, message: `Country not matched: "${rawCountry}"`, severity: 'error' });
        errorRows++;
        continue;
      }

      countriesMatched.add(dbCountry.name);
      let rowHasValue = false;

      for (const mapping of config.mappings) {
        const colIdx = headers.findIndex((h) => h.toLowerCase() === mapping.column.toLowerCase());
        if (colIdx < 0) continue;

        const cellValue = row[colIdx];
        if (cellValue === null || cellValue === undefined || cellValue === '') continue;

        let num = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue).replace(/,/g, ''));
        if (isNaN(num)) {
          errors.push({ row: rowIdx + dataStartRow + 1, column: mapping.column, message: `Non-numeric value: "${cellValue}"`, severity: 'warning' });
          continue;
        }

        // Apply transform
        if (mapping.transform === 'multiply_1000') num *= 1000;
        else if (mapping.transform === 'divide_100') num /= 100;
        else if (mapping.transform === 'invert') num = 100 - num;

        const indicator = indicatorMap.get(mapping.indicatorSlug);
        if (!indicator) {
          errors.push({ row: rowIdx + dataStartRow + 1, column: mapping.column, message: `Indicator not found: "${mapping.indicatorSlug}"`, severity: 'error' });
          continue;
        }

        // Range validation
        if (indicator.unit === 'PERCENTAGE' && (num < 0 || num > 100)) {
          errors.push({ row: rowIdx + dataStartRow + 1, column: mapping.column, message: `Value ${num} out of percentage range (0-100)`, severity: 'warning' });
        }

        const year = mapping.year || config.year || new Date().getFullYear();
        const gender = (mapping.gender || 'TOTAL') as import('@prisma/client').GenderType;
        // Default to AU 15-35 — matches the schema default and the platform's canonical youth band.
        const ageGroup = mapping.ageGroup || '15-35';

        parsedValues!.push({
          countryId: dbCountry.id,
          indicatorId: indicator.id,
          year,
          value: num,
          gender,
          ageGroup,
          source: config.source,
        });

        indicatorCounts.set(mapping.indicatorSlug, (indicatorCounts.get(mapping.indicatorSlug) || 0) + 1);
        rowHasValue = true;

        // Add to preview (first 20 mapped rows)
        if (mappedPreview.length < 20) {
          mappedPreview.push({
            country: dbCountry.name,
            indicator: indicator.name,
            year,
            value: num,
            gender,
            status: 'valid',
          });
        }
      }

      if (rowHasValue) validRows++;
    }

    // Build job
    const jobId = crypto.randomUUID();
    const job: UploadJob = {
      id: jobId,
      userId,
      fileName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'preview',
      config,
      summary: {
        totalRows: dataRows.length,
        validRows,
        errorRows,
        countriesMatched: countriesMatched.size,
        countriesUnmatched: Array.from(countriesUnmatched),
        indicatorsMapped: indicatorCounts.size,
        valuesTotal: parsedValues!.length,
        valuesByIndicator: Array.from(indicatorCounts.entries()).map(([slug, count]) => ({
          slug,
          name: indicatorMap.get(slug)?.name || slug,
          count,
        })),
      },
      preview: {
        headers: headers.filter(Boolean),
        rows: dataRows.slice(0, 20).map((r) => r.slice(0, 15)),
        mappedPreview,
      },
      errors: errors.slice(0, 100),
      parsedValues,
    };

    jobStore.set(jobId, job);
    return job;
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  getPreview(jobId: string, userId: string): Omit<UploadJob, 'parsedValues'> {
    const job = jobStore.get(jobId);
    if (!job) throw new NotFoundException('Upload job not found or expired');
    if (job.userId !== userId) throw new NotFoundException('Upload job not found');
    const { parsedValues, ...rest } = job;
    return rest;
  }

  // ── Commit ─────────────────────────────────────────────────────────────────

  async commitJob(jobId: string, userId: string) {
    const job = jobStore.get(jobId);
    if (!job) throw new NotFoundException('Upload job not found or expired');
    if (job.userId !== userId) throw new NotFoundException('Upload job not found');
    if (job.status === 'committed') throw new BadRequestException('This upload has already been committed');
    if (!job.parsedValues?.length) throw new BadRequestException('No valid data to commit');

    const startTime = Date.now();
    const total = job.parsedValues.length;
    let inserted = 0;
    let errCount = 0;
    let lastError: string | null = null;

    job.status = 'committing';
    job.commitProgress = { current: 0, total, percent: 0, startedAt: startTime, etaMs: null };

    // Batched raw-SQL upsert: one INSERT ... ON CONFLICT per chunk. Each chunk
    // is a single round-trip to Postgres regardless of how many rows it carries,
    // which is the only sane way to handle hundreds of upserts through PgBouncer
    // with connection_limit=1. ~10s for 1000 rows in our setup, vs. ~19 minutes
    // for sequential per-row upserts.
    const BATCH = 200;
    for (let i = 0; i < total; i += BATCH) {
      const slice = job.parsedValues.slice(i, i + BATCH);
      try {
        const valuesSql = Prisma.join(
          slice.map((v) => Prisma.sql`(
            ${crypto.randomUUID()},
            ${v.countryId},
            ${v.indicatorId},
            ${v.year},
            ${v.value},
            ${v.gender}::"GenderType",
            ${v.ageGroup},
            ${v.source},
            0.9,
            false,
            NOW()
          )`),
          ',',
        );
        await this.prisma.$executeRaw`
          INSERT INTO "IndicatorValue"
            (id, "countryId", "indicatorId", year, value, gender, "ageGroup", source, confidence, "isEstimate", "createdAt")
          VALUES ${valuesSql}
          ON CONFLICT ("countryId", "indicatorId", year, gender, "ageGroup")
          DO UPDATE SET
            value = EXCLUDED.value,
            source = EXCLUDED.source,
            confidence = EXCLUDED.confidence
        `;
        inserted += slice.length;
      } catch (err: any) {
        errCount += slice.length;
        lastError = err?.message ?? String(err);
        // eslint-disable-next-line no-console
        console.error('[commitJob] batch failed at row', i, ':', lastError);
      }

      job.commitProgress.current = Math.min(i + BATCH, total);
      job.commitProgress.percent = Math.round((job.commitProgress.current / total) * 100);
      const elapsed = Date.now() - startTime;
      job.commitProgress.etaMs =
        job.commitProgress.current > 0
          ? Math.round((elapsed / job.commitProgress.current) * (total - job.commitProgress.current))
          : null;
    }

    job.status = 'committed';
    job.result = {
      inserted,
      skipped: 0,
      errors: errCount,
      duration: Date.now() - startTime,
    };
    delete (job as any).parsedValues; // free memory

    // Persistent audit row so the History tab survives API restarts.
    await this.writeAudit({
      kind: (job as any).ayims ? 'AYIMS_TEMPLATE' : 'GENERIC_DATA',
      fileName: job.fileName,
      fileSize: job.fileSize,
      status: errCount > 0 ? 'PARTIAL' : 'SUCCESS',
      rowsAffected: inserted,
      countryId: (job as any).ayims?.countryId ?? null,
      source: job.config?.source ?? null,
      notes: job.config?.notes ?? null,
      uploadedById: job.userId,
      durationMs: job.result.duration,
      errorMessage: errCount > 0 ? `${errCount} batch errors during commit` : null,
    });

    return job.result;
  }

  /**
   * Insert one audit row for an upload commit. Wraps Prisma in a try/catch so
   * an audit-write failure never breaks a successful commit. The row is the
   * source of truth for the History tab.
   */
  private async writeAudit(data: {
    kind: 'AYIMS_TEMPLATE' | 'POLICIES_DATABASE' | 'DOCUMENT' | 'GENERIC_DATA';
    fileName: string;
    fileSize: number;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    rowsAffected: number;
    countryId?: string | null;
    documentId?: string | null;
    source?: string | null;
    notes?: string | null;
    uploadedById?: string | null;
    durationMs?: number | null;
    errorMessage?: string | null;
  }) {
    try {
      await this.prisma.uploadAudit.create({
        data: {
          kind: data.kind as any,
          fileName: data.fileName,
          fileSize: data.fileSize,
          status: data.status as any,
          rowsAffected: data.rowsAffected,
          countryId: data.countryId ?? null,
          documentId: data.documentId ?? null,
          source: data.source ?? null,
          notes: data.notes ?? null,
          uploadedById: data.uploadedById && data.uploadedById !== 'anonymous' ? data.uploadedById : null,
          durationMs: data.durationMs ?? null,
          errorMessage: data.errorMessage ?? null,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[upload-audit] failed to write audit row:', (err as Error).message);
    }
  }

  /**
   * Live progress for an in-flight commit. Frontend polls this every ~500ms
   * while the commit fetch is in-flight to render a progress bar + ETA.
   */
  getCommitStatus(jobId: string, userId: string) {
    const job = jobStore.get(jobId);
    if (!job) throw new NotFoundException('Upload job not found or expired');
    if (job.userId !== userId) throw new NotFoundException('Upload job not found');
    return {
      status: job.status,
      progress: job.commitProgress ?? null,
      result: job.result ?? null,
    };
  }

  // ── AYIMS Template Upload ──────────────────────────────────────────────────
  //
  // Parses a country-specific AYIMS Data Entry Template — wide format with
  // years as rows and 54 indicators as columns. The country is detected from
  // the filename (e.g. "Angola_AYIMS_Template_v1.xlsx" → Angola). Each cell
  // becomes one IndicatorValue row.
  //
  // Produces the same UploadJob shape as `uploadFile`, so the existing
  // preview / commit / history flow works unchanged.

  async uploadAyimsTemplate(
    file: Express.Multer.File,
    userId: string,
    overrides: { countryId?: string; source?: string; notes?: string } = {},
  ): Promise<UploadJob> {
    cleanExpiredJobs();

    if (!file) throw new BadRequestException('No file provided');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File exceeds 10MB limit');

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext || '')) {
      throw new BadRequestException('AYIMS templates must be XLSX or XLS files');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const targetSheet = workbook.SheetNames.find((n) => /AYIMS Data Template/i.test(n))
      ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheet];
    if (!sheet) throw new BadRequestException(`No AYIMS Data Template sheet found in: ${workbook.SheetNames.join(', ')}`);

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Standard AYIMS layout — fixed indices.
    const HEADER_ROW = 3;     // indicator names
    const UNITS_ROW = 4;      // units (informational)
    const DATA_START_ROW = 7; // first year of data (2006)

    if (rows.length <= DATA_START_ROW) {
      throw new BadRequestException(`Template appears empty or malformed — only ${rows.length} rows.`);
    }

    const headers = (rows[HEADER_ROW] || []).map((h: any) => String(h ?? '').trim());
    const units = (rows[UNITS_ROW] || []).map((h: any) => String(h ?? '').trim());

    // Resolve country — explicit override > filename > row 1 metadata.
    const dbCountries = await this.prisma.country.findMany({
      select: { id: true, name: true, isoCode2: true, isoCode3: true },
    });
    const countryByKey = new Map<string, { id: string; name: string }>();
    for (const c of dbCountries) {
      countryByKey.set(c.name.toLowerCase(), { id: c.id, name: c.name });
      countryByKey.set(c.isoCode2.toLowerCase(), { id: c.id, name: c.name });
      countryByKey.set(c.isoCode3.toLowerCase(), { id: c.id, name: c.name });
    }
    for (const [alias, real] of Object.entries(COUNTRY_ALIASES)) {
      const found = countryByKey.get(real.toLowerCase());
      if (found) countryByKey.set(alias, found);
    }

    let resolvedCountry: { id: string; name: string } | undefined;
    if (overrides.countryId) {
      const c = dbCountries.find((x) => x.id === overrides.countryId);
      if (c) resolvedCountry = { id: c.id, name: c.name };
    }
    if (!resolvedCountry) resolvedCountry = inferCountryFromFilename(file.originalname, countryByKey);
    if (!resolvedCountry) resolvedCountry = inferCountryFromMetadata(rows, countryByKey);

    if (!resolvedCountry) {
      throw new BadRequestException(
        `Could not detect country from filename "${file.originalname}" or sheet metadata. Please pass countryId explicitly.`,
      );
    }

    // Load AYO indicators.
    const dbIndicators = await this.prisma.indicator.findMany({
      select: { id: true, slug: true, name: true, unit: true },
    });
    const indicatorBySlug = new Map(dbIndicators.map((i) => [i.slug, i]));

    const mapping = ayimsMappingFile.columns as Record<string, AyimsColumnSpec>;

    // Walk every (year × indicator-column) cell.
    const errors: UploadJob['errors'] = [];
    const parsedValues: NonNullable<UploadJob['parsedValues']> = [];
    const indicatorCounts = new Map<string, number>();
    const skippedColumns: string[] = [];
    const unmappedColumns: string[] = [];
    const yearsSeen = new Set<number>();
    const mappedPreview: UploadJob['preview']['mappedPreview'] = [];

    for (let r = DATA_START_ROW; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawYear = row[0];
      if (rawYear === null || rawYear === undefined || rawYear === '') continue;
      const year = parseInt(String(rawYear).replace(/[^0-9]/g, ''), 10);
      if (isNaN(year) || year < 1990 || year > 2100) continue;
      yearsSeen.add(year);

      for (let c = 1; c < headers.length; c++) {
        const colHeader = headers[c];
        if (!colHeader) continue;
        const spec = mapping[colHeader];

        if (!spec) {
          if (!unmappedColumns.includes(colHeader)) unmappedColumns.push(colHeader);
          continue;
        }
        if (spec.skip) {
          if (!skippedColumns.includes(colHeader)) skippedColumns.push(colHeader);
          continue;
        }

        const cell = row[c];
        if (cell === null || cell === undefined || cell === '') continue;

        let num = typeof cell === 'number' ? cell : parseFloat(String(cell).replace(/,/g, ''));
        if (isNaN(num)) {
          errors.push({
            row: r + 1,
            column: colHeader,
            message: `Non-numeric value in ${year} ${colHeader}: "${cell}"`,
            severity: 'warning',
          });
          continue;
        }

        if (spec.transform === 'multiply_1000') num *= 1000;
        else if (spec.transform === 'divide_100') num /= 100;
        else if (spec.transform === 'invert') num = 100 - num;

        const indicator = indicatorBySlug.get(spec.slug!);
        if (!indicator) {
          errors.push({
            row: r + 1,
            column: colHeader,
            message: `Mapped slug "${spec.slug}" not in indicator catalog — run db:seed.`,
            severity: 'error',
          });
          continue;
        }

        // Range sanity-check. Gross Enrollment Ratios can legitimately exceed 100%
        // (over-age + under-age students count), so we only warn when (a) the unit
        // is PERCENTAGE *and* the indicator isn't a known gross-ratio metric.
        const ALLOW_OVER_100 = new Set([
          'primary-enrollment-rate',
          'secondary-school-net-enrollment-rate',
          'tertiary-education-gross-enrollment-rate',
          'youth-share-of-population',
          'youth-rural-share',
          'youth-urban-share',
        ]);
        if (
          indicator.unit === 'PERCENTAGE' &&
          (num < 0 || num > 100) &&
          !ALLOW_OVER_100.has(spec.slug!)
        ) {
          errors.push({
            row: r + 1,
            column: colHeader,
            message: `Value ${num} out of percentage range (0–100) for ${year}`,
            severity: 'warning',
          });
        }

        const gender = (spec.gender || 'TOTAL') as import('@prisma/client').GenderType;
        const ageGroup = spec.ageGroup || '15-35';

        parsedValues.push({
          countryId: resolvedCountry.id,
          indicatorId: indicator.id,
          year,
          value: num,
          gender,
          ageGroup,
          source: overrides.source || 'AYIMS / AU Commission',
        });
        indicatorCounts.set(spec.slug!, (indicatorCounts.get(spec.slug!) || 0) + 1);

        if (mappedPreview.length < 25) {
          mappedPreview.push({
            country: resolvedCountry.name,
            indicator: indicator.name,
            year,
            value: num,
            gender,
            status: 'valid',
          });
        }
      }
    }

    const jobId = crypto.randomUUID();
    const job: UploadJob = {
      id: jobId,
      userId,
      fileName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'preview',
      config: {
        sheetName: targetSheet,
        countryColumn: '__ayims_template__',
        countryFormat: 'name',
        mappings: [],
        source: overrides.source || 'AYIMS / AU Commission',
        notes: overrides.notes,
      },
      summary: {
        totalRows: yearsSeen.size,
        validRows: yearsSeen.size,
        errorRows: 0,
        countriesMatched: 1,
        countriesUnmatched: [],
        indicatorsMapped: indicatorCounts.size,
        valuesTotal: parsedValues.length,
        valuesByIndicator: Array.from(indicatorCounts.entries()).map(([slug, count]) => ({
          slug,
          name: indicatorBySlug.get(slug)?.name || slug,
          count,
        })),
      },
      preview: {
        headers: headers.filter(Boolean),
        rows: rows.slice(DATA_START_ROW, DATA_START_ROW + 5).map((r) => (r || []).slice(0, 12)),
        mappedPreview,
      },
      errors: errors.slice(0, 100),
      parsedValues,
    } as UploadJob;

    // Tag extra info on the job for the frontend's AYIMS-aware preview UI.
    (job as any).ayims = {
      detectedCountry: resolvedCountry.name,
      countryId: resolvedCountry.id,
      yearsCovered: Array.from(yearsSeen).sort((a, b) => a - b),
      headerSample: headers.slice(0, 5).filter(Boolean),
      unitsSample: units.slice(0, 5).filter(Boolean),
      mappedColumnCount: Object.keys(mapping).filter((k) => !mapping[k].skip && mapping[k].slug).length,
      skippedColumns,
      unmappedColumns,
    };

    jobStore.set(jobId, job);
    return job;
  }

  // ── Policies Database Upload ───────────────────────────────────────────────
  //
  // Parses the African National Youth Policies Database (CSV or XLSX). Each
  // row = one country; each of the 30 policy columns becomes one CountryPolicy
  // record after scoring (status × recency, with legal-marker bonus).

  async uploadPoliciesDatabase(
    file: Express.Multer.File,
    userId: string,
    overrides: { source?: string; notes?: string } = {},
  ): Promise<PolicyUploadJob> {
    cleanExpiredJobs();
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File exceeds 10MB limit');

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      throw new BadRequestException('Policies database must be CSV, XLSX, or XLS');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    // For XLSX prefer the cleaned-source sheet if present; for CSV there's only one sheet.
    const sheetName =
      workbook.SheetNames.find((n) => /Source.*cleaned|Youth Policies/i.test(n)) ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new BadRequestException(`No sheet found in: ${workbook.SheetNames.join(', ')}`);

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Header detection — find the first row whose values include "Country" + at least one policy column key.
    const policyKeys = (policiesConfigFile.policyColumns as { key: string }[]).map((p) => p.key);
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = (rows[i] || []).map((c) => String(c ?? '').trim());
      const hasCountry = row.some((c) => c.toLowerCase() === 'country');
      const hasPolicyKey = policyKeys.some((k) => row.includes(k));
      if (hasCountry && hasPolicyKey) { headerIdx = i; break; }
    }
    if (headerIdx < 0) {
      throw new BadRequestException(
        'Could not locate header row. Expected a row containing "Country" plus the policy-column names from the African National Youth Policies Database.',
      );
    }

    const headers = (rows[headerIdx] || []).map((c) => String(c ?? '').trim());
    const countryIdx = headers.findIndex((h) => h.toLowerCase() === 'country');
    const dataRows = rows.slice(headerIdx + 1).filter((r) => r && (r[countryIdx] || '').toString().trim());

    // Resolve countries.
    const dbCountries = await this.prisma.country.findMany({
      select: { id: true, name: true, isoCode2: true, isoCode3: true },
    });
    const countryByKey = new Map<string, { id: string; name: string }>();
    for (const c of dbCountries) {
      countryByKey.set(c.name.toLowerCase(), { id: c.id, name: c.name });
      countryByKey.set(c.isoCode2.toLowerCase(), { id: c.id, name: c.name });
      countryByKey.set(c.isoCode3.toLowerCase(), { id: c.id, name: c.name });
    }
    for (const [alias, real] of Object.entries(COUNTRY_ALIASES)) {
      const found = countryByKey.get(real.toLowerCase());
      if (found) countryByKey.set(alias, found);
    }

    const records: ParsedPolicyRecord[] = [];
    const errors: PolicyUploadJob['errors'] = [];
    const matched = new Set<string>();
    const unmatched = new Set<string>();
    let inPlace = 0;
    let drafts = 0;
    let missing = 0;

    const policyCols = policiesConfigFile.policyColumns as Array<{ key: string; dimension: string; policyType: string }>;
    const colIdxByKey = new Map<string, number>();
    for (const p of policyCols) {
      const idx = headers.indexOf(p.key);
      if (idx >= 0) colIdxByKey.set(p.key, idx);
    }

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      const rawCountry = String(row[countryIdx] || '').trim();
      if (!rawCountry) continue;

      const lookupKey = (COUNTRY_ALIASES[rawCountry.toLowerCase()] || rawCountry).toLowerCase();
      const dbCountry = countryByKey.get(lookupKey);
      if (!dbCountry) {
        unmatched.add(rawCountry);
        errors.push({ row: r + headerIdx + 2, column: 'Country', message: `Country not matched: "${rawCountry}"`, severity: 'error' });
        continue;
      }
      matched.add(dbCountry.name);

      for (const p of policyCols) {
        const idx = colIdxByKey.get(p.key);
        if (idx === undefined) continue;
        const text = String(row[idx] ?? '').trim();

        let statusScore: number;
        let status: 'active' | 'draft' | 'missing';
        if (!text) {
          statusScore = policiesConfigFile._meta.scoringRules.missing;
          status = 'missing';
          missing++;
        } else if (isDraftMarker(text)) {
          statusScore = policiesConfigFile._meta.scoringRules.draft;
          status = 'draft';
          drafts++;
        } else {
          statusScore = policiesConfigFile._meta.scoringRules.inPlace;
          status = 'active';
          inPlace++;
        }

        const legal = text ? hasLegalAnchor(text) : false;
        const yearAdopted = text ? extractLatestYear(text) : null;
        const recency = recencyFactorFor(yearAdopted);
        const baseScore = Math.min(
          policiesConfigFile._meta.scoringRules.cap,
          statusScore + (legal && status !== 'missing' ? policiesConfigFile._meta.scoringRules.legalMarkerBonus : 0),
        );
        const complianceScore = +(baseScore * recency).toFixed(3);

        records.push({
          countryId: dbCountry.id,
          countryName: dbCountry.name,
          policyType: p.policyType,
          policyName: text || `(${p.policyType} — not yet adopted)`,
          dimension: p.dimension,
          yearAdopted,
          status,
          hasLegalMarker: legal,
          statusScore,
          recencyFactor: recency,
          complianceScore,
        });
      }
    }

    const averageScore = records.length
      ? +(records.reduce((s, r) => s + r.complianceScore, 0) / records.length).toFixed(3)
      : 0;

    const jobId = POLICY_JOB_PREFIX + crypto.randomUUID();
    const job: PolicyUploadJob = {
      id: jobId,
      userId,
      fileName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'preview',
      source: overrides.source || 'African National Youth Policies Database (PACSDA)',
      notes: overrides.notes,
      summary: {
        countriesMatched: matched.size,
        countriesUnmatched: Array.from(unmatched),
        policiesParsed: records.length,
        inPlace,
        drafts,
        missing,
        averageScore,
      },
      records,
      errors: errors.slice(0, 100),
    };
    policyJobStore.set(jobId, job);
    return job;
  }

  /**
   * Commit a previewed policy job — upserts into CountryPolicy and refreshes
   * complianceScore + status. Existing AYC ratification info is preserved.
   */
  async commitPoliciesJob(jobId: string, userId: string) {
    const job = policyJobStore.get(jobId);
    if (!job) throw new NotFoundException('Policy upload job not found or expired');
    if (job.userId !== userId) throw new NotFoundException('Policy upload job not found');
    if (job.status === 'committed') throw new BadRequestException('This upload has already been committed');
    if (!job.records.length) throw new BadRequestException('No policy records to commit');

    const startTime = Date.now();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errCount = 0;

    for (const rec of job.records) {
      try {
        // Upsert by (countryId + policyType). The schema doesn't have a composite unique
        // constraint, so we look up first then create-or-update.
        const existing = await this.prisma.countryPolicy.findFirst({
          where: { countryId: rec.countryId, policyType: rec.policyType },
        });

        if (existing) {
          await this.prisma.countryPolicy.update({
            where: { id: existing.id },
            data: {
              policyName: rec.policyName,
              yearAdopted: rec.yearAdopted ?? existing.yearAdopted,
              complianceScore: rec.complianceScore,
              status: rec.status,
            },
          });
          updated++;
        } else {
          await this.prisma.countryPolicy.create({
            data: {
              countryId: rec.countryId,
              policyName: rec.policyName,
              policyType: rec.policyType,
              yearAdopted: rec.yearAdopted,
              complianceScore: rec.complianceScore,
              status: rec.status,
            },
          });
          inserted++;
        }
      } catch (err: any) {
        if (err.code === 'P2002') skipped++;
        else errCount++;
      }
    }

    job.status = 'committed';
    job.result = { inserted, updated, skipped, errors: errCount, duration: Date.now() - startTime };

    await this.writeAudit({
      kind: 'POLICIES_DATABASE',
      fileName: job.fileName,
      fileSize: job.fileSize,
      status: errCount > 0 ? 'PARTIAL' : 'SUCCESS',
      rowsAffected: inserted + updated,
      source: job.source ?? null,
      notes: job.notes ?? null,
      uploadedById: job.userId,
      durationMs: job.result.duration,
      errorMessage: errCount > 0 ? `${errCount} record errors during commit` : null,
    });

    return job.result;
  }

  /** Returns a previewed policy job (without trimming records — used by the preview UI). */
  getPolicyPreview(jobId: string, userId: string) {
    const job = policyJobStore.get(jobId);
    if (!job) throw new NotFoundException('Policy upload job not found or expired');
    if (job.userId !== userId) throw new NotFoundException('Policy upload job not found');
    return job;
  }

  // ── History ────────────────────────────────────────────────────────────────

  /**
   * History — every committed upload, persisted in the UploadAudit table.
   * Admins see everything; contributors see their own uploads. Survives API
   * restarts (the prior in-memory jobStore did not — that's why team uploads
   * were vanishing from the History tab whenever Render redeployed).
   */
  async getHistory(userId: string, isAdmin: boolean) {
    const where = isAdmin ? {} : { uploadedById: userId };
    const rows = await this.prisma.uploadAudit.findMany({
      where,
      include: {
        country: { select: { id: true, name: true, isoCode3: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, type: true, title: true } },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 200,
    });

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      fileName: r.fileName,
      fileSize: r.fileSize,
      status: r.status,
      rowsAffected: r.rowsAffected,
      country: r.country,
      source: r.source,
      notes: r.notes,
      document: r.document,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.uploadedAt,
      durationMs: r.durationMs,
      errorMessage: r.errorMessage,
    }));
  }

  async getHistoryDetail(id: string, userId: string, isAdmin: boolean) {
    const row = await this.prisma.uploadAudit.findUnique({
      where: { id },
      include: {
        country: { select: { id: true, name: true, isoCode3: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, type: true, title: true, originalFilename: true } },
      },
    });
    if (!row) throw new NotFoundException('Upload not found');
    if (!isAdmin && row.uploadedById !== userId) throw new NotFoundException('Upload not found');
    return row;
  }

  async deleteUpload(id: string) {
    const row = await this.prisma.uploadAudit.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Upload not found');
    await this.prisma.uploadAudit.delete({ where: { id } });
    return { message: 'Upload record deleted' };
  }

  // ── Data needs ─────────────────────────────────────────────────────────────

  async getDataNeeds() {
    const [totalCountries, indicators, valueCounts] = await Promise.all([
      this.prisma.country.count(),
      this.prisma.indicator.findMany({
        select: { id: true, slug: true, name: true, source: true, theme: { select: { name: true, slug: true } } },
      }),
      this.prisma.indicatorValue.groupBy({
        by: ['indicatorId'],
        _count: { countryId: true },
      }),
    ]);

    const coverageMap = new Map(valueCounts.map((v) => [v.indicatorId, v._count.countryId]));

    // Country-level gaps
    const countryCounts = await this.prisma.indicatorValue.groupBy({
      by: ['countryId'],
      _count: { indicatorId: true },
    });
    const countryCoverageMap = new Map(countryCounts.map((c) => [c.countryId, c._count.indicatorId]));
    const allCountries = await this.prisma.country.findMany({
      select: { id: true, name: true, isoCode3: true },
      orderBy: { name: 'asc' },
    });

    const totalIndicators = indicators.length;

    // By theme
    const themeGroups = new Map<string, { name: string; indicators: typeof indicators }>();
    for (const ind of indicators) {
      const key = ind.theme.slug;
      if (!themeGroups.has(key)) themeGroups.set(key, { name: ind.theme.name, indicators: [] });
      themeGroups.get(key)!.indicators.push(ind);
    }

    let totalGaps = 0;
    let highGaps = 0;
    let medGaps = 0;
    let lowGaps = 0;

    const byTheme = Array.from(themeGroups.entries()).map(([slug, group]) => {
      let themeCountriesTotal = 0;
      let themeCountriesHave = 0;

      const missingIndicators = group.indicators.map((ind) => {
        const coverage = coverageMap.get(ind.id) || 0;
        const missing = totalCountries - coverage;
        const completeness = totalCountries > 0 ? coverage / totalCountries : 0;
        const priority = completeness < 0.3 ? 'high' : completeness < 0.7 ? 'medium' : 'low';

        themeCountriesTotal += totalCountries;
        themeCountriesHave += coverage;
        totalGaps += missing;
        if (priority === 'high') highGaps += missing;
        else if (priority === 'medium') medGaps += missing;
        else lowGaps += missing;

        return {
          slug: ind.slug,
          name: ind.name,
          countriesCovered: coverage,
          countriesMissing: missing,
          priority,
          suggestedSources: [ind.source || 'National statistics bureaus'],
        };
      }).filter((i) => i.countriesMissing > 0).sort((a, b) => b.countriesMissing - a.countriesMissing);

      return {
        theme: group.name,
        slug,
        completeness: themeCountriesTotal > 0 ? Math.round((themeCountriesHave / themeCountriesTotal) * 100) / 100 : 0,
        missingIndicators,
      };
    }).sort((a, b) => a.completeness - b.completeness);

    const byCountry = allCountries.map((c) => {
      const covered = countryCoverageMap.get(c.id) || 0;
      const missing = totalIndicators - covered;
      const completeness = totalIndicators > 0 ? Math.round((covered / totalIndicators) * 100) / 100 : 0;
      return {
        country: c.name,
        isoCode3: c.isoCode3,
        completeness,
        missingCount: missing,
        coveredCount: covered,
        priority: completeness < 0.3 ? 'high' : completeness < 0.7 ? 'medium' : 'low',
      };
    }).sort((a, b) => a.completeness - b.completeness);

    return {
      summary: {
        totalGaps,
        criticalGaps: highGaps,
        byPriority: { high: highGaps, medium: medGaps, low: lowGaps },
      },
      byTheme,
      byCountry: byCountry.slice(0, 20),
    };
  }

  // ── Indicators list for mapping UI ─────────────────────────────────────────

  async getIndicatorsForMapping() {
    const indicators = await this.prisma.indicator.findMany({
      select: { id: true, slug: true, name: true, unit: true, source: true, theme: { select: { name: true } } },
      orderBy: [{ theme: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    // Get coverage stats
    const coverageCounts = await this.prisma.indicatorValue.groupBy({
      by: ['indicatorId'],
      _count: { countryId: true },
      _max: { year: true },
    });
    const coverageMap = new Map(coverageCounts.map((c) => [c.indicatorId, { countries: c._count.countryId, latestYear: c._max.year }]));

    return indicators.map((ind) => {
      const coverage = coverageMap.get(ind.id);
      const expectedRange = ind.unit === 'PERCENTAGE' ? { min: 0, max: 100 }
        : ind.unit === 'RATE' ? { min: 0, max: 1000 }
        : { min: 0, max: 999999 };

      return {
        id: ind.id,
        slug: ind.slug,
        name: ind.name,
        theme: ind.theme.name,
        unit: ind.unit,
        expectedRange,
        currentCoverage: { countries: coverage?.countries || 0, latestYear: coverage?.latestYear || null },
        source: ind.source,
      };
    });
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  getTemplates() {
    return [
      { slug: 'education-indicators', name: 'Education Indicators', description: 'Literacy, enrollment, completion rates by country', indicatorCount: 6, columns: ['Country', 'ISO3', 'Year', 'Youth Literacy Rate (%)', 'Primary Enrollment Rate (%)', 'Secondary Enrollment Rate (%)', 'Tertiary Enrollment Rate (%)', 'Education Spending (% GDP)', 'Mean Years of Schooling'] },
      { slug: 'employment-indicators', name: 'Employment Indicators', description: 'Unemployment, labor participation, NEET rates', indicatorCount: 7, columns: ['Country', 'ISO3', 'Year', 'Youth Unemployment Rate (%)', 'Labor Force Participation (%)', 'NEET Rate (%)', 'Informal Employment (%)', 'Self-Employment (%)'] },
      { slug: 'health-indicators', name: 'Health Indicators', description: 'Health expenditure, HIV, mortality', indicatorCount: 7, columns: ['Country', 'ISO3', 'Year', 'Life Expectancy', 'Under-5 Mortality', 'HIV Prevalence Youth (%)', 'Health Expenditure (% GDP)', 'Maternal Mortality'] },
      { slug: 'civic-governance', name: 'Civic Engagement & Governance', description: 'Voter registration, political participation', indicatorCount: 4, columns: ['Country', 'ISO3', 'Year', 'Youth Voter Registration (%)', 'Women in Parliament (%)', 'Voice & Accountability Score'] },
      { slug: 'innovation-technology', name: 'Innovation & Technology', description: 'Internet, mobile, R&D', indicatorCount: 4, columns: ['Country', 'ISO3', 'Year', 'Internet Penetration (%)', 'Mobile Subscriptions (per 100)', 'R&D Expenditure (% GDP)', 'Fixed Broadband (per 100)'] },
      { slug: 'financial-inclusion', name: 'Financial Inclusion', description: 'Bank accounts, mobile money, credit', indicatorCount: 3, columns: ['Country', 'ISO3', 'Year', 'Account Ownership Youth (%)', 'Mobile Money Usage (%)', 'Microcredit Recipients'] },
      { slug: 'gender', name: 'Gender Equality', description: 'Gender parity, female participation', indicatorCount: 3, columns: ['Country', 'ISO3', 'Year', 'Gender Parity Index (Education)', 'Female Labor Participation (%)', 'Women in Parliament (%)'] },
      { slug: 'environment', name: 'Environment & Climate', description: 'Electricity, water, emissions', indicatorCount: 4, columns: ['Country', 'ISO3', 'Year', 'Access to Clean Water (%)', 'Electricity Access (%)', 'Forest Area (%)', 'CO2 per Capita'] },
      { slug: 'full-ayims', name: 'Full AYIMS Format (AU Commission)', description: 'Complete 42-indicator format matching AU Youth Division datasheet', indicatorCount: 42, columns: ['Country', 'Total Pop (M)', 'Youth Pop 15-35 (M)', 'Youth % of Total', '...all 42 columns'] },
    ];
  }

  async downloadTemplate(slug: string) {
    const countries = await this.prisma.country.findMany({
      select: { name: true, isoCode3: true },
      orderBy: { name: 'asc' },
    });

    const templates = this.getTemplates();
    const template = templates.find((t) => t.slug === slug);
    if (!template) throw new NotFoundException(`Template "${slug}" not found`);

    const headers = template.columns;
    const rows = countries.map((c) => {
      const row = new Array(headers.length).fill('');
      row[0] = c.name;
      if (headers.includes('ISO3')) row[1] = c.isoCode3;
      return row;
    });

    // Generate CSV
    const csvLines = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((v: string) => `"${v}"`).join(',')),
    ];

    return csvLines.join('\n');
  }
}
