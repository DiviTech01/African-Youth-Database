import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { ExportQueryDto } from './export.dto';
import { formatRegion } from '../../common/utils/format';

const EXPORT_THEME_LABELS: Record<string, string> = {
  'youth-demography-participation': 'Youth Demography & Participation',
  'education': 'Education',
  'employment': 'Employment',
  'health': 'Health',
  'entrepreneurship': 'Entrepreneurship',
  'peace-security': 'Peace & Security',
  'access-to-justice': 'Access to Justice',
};
const EXPORT_THEME_ORDER = Object.keys(EXPORT_THEME_LABELS);

interface ExportRow {
  country: string;
  isoCode: string;
  region: string;
  indicator: string;
  theme: string;
  year: number;
  value: number;
  unit: string;
  gender: string;
  ageGroup: string;
  source: string;
  confidence: number;
  isEstimate: boolean;
}

@Injectable()
export class ExportService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Check export rate limit and row limit based on user role.
   */
  checkLimits(role: string | null, rowCount: number) {
    if (!role) {
      // Public / unauthenticated
      if (rowCount > 100) {
        throw new ForbiddenException(
          'Unauthenticated exports are limited to 100 rows. Please sign in for larger exports.',
        );
      }
    } else if (role === 'REGISTERED') {
      if (rowCount > 10000) {
        throw new ForbiddenException('Registered users can export up to 10,000 rows.');
      }
    }
    // ADMIN, RESEARCHER, INSTITUTIONAL, CONTRIBUTOR: unlimited
  }

  /**
   * Fetch data rows based on export filters.
   */
  async fetchData(query: ExportQueryDto, maxRows?: number): Promise<ExportRow[]> {
    const where: Record<string, unknown> = { gender: 'TOTAL' };

    if (query.countryId) where.countryId = query.countryId;
    if (query.countryIds) {
      where.countryId = { in: query.countryIds.split(',').map((s) => s.trim()) };
    }
    if (query.indicatorId) where.indicatorId = query.indicatorId;
    if (query.gender) where.gender = query.gender;
    if (query.ageGroup) where.ageGroup = query.ageGroup;
    if (query.themeId) where.indicator = { themeId: query.themeId };

    if (query.yearStart || query.yearEnd) {
      where.year = {};
      if (query.yearStart) (where.year as Record<string, number>).gte = query.yearStart;
      if (query.yearEnd) (where.year as Record<string, number>).lte = query.yearEnd;
    }

    const values = await this.prisma.indicatorValue.findMany({
      where,
      include: {
        country: { select: { name: true, isoCode3: true, region: true } },
        indicator: {
          select: {
            name: true,
            unit: true,
            theme: { select: { name: true } },
          },
        },
      },
      orderBy: [{ country: { name: 'asc' } }, { year: 'desc' }],
      take: maxRows || 50000,
    });

    return values.map((v) => ({
      country: v.country.name,
      isoCode: v.country.isoCode3,
      region: formatRegion(v.country.region),
      indicator: v.indicator.name,
      theme: v.indicator.theme.name,
      year: v.year,
      value: v.value,
      unit: v.indicator.unit,
      gender: v.gender,
      ageGroup: v.ageGroup,
      source: v.source,
      confidence: v.confidence,
      isEstimate: v.isEstimate,
    }));
  }

  /**
   * Build filter description for metadata.
   */
  describeFilters(query: ExportQueryDto): Record<string, string> {
    const filters: Record<string, string> = {};
    if (query.countryId) filters.countryId = query.countryId;
    if (query.countryIds) filters.countryIds = query.countryIds;
    if (query.indicatorId) filters.indicatorId = query.indicatorId;
    if (query.themeId) filters.themeId = query.themeId;
    if (query.yearStart) filters.yearStart = String(query.yearStart);
    if (query.yearEnd) filters.yearEnd = String(query.yearEnd);
    if (query.gender) filters.gender = query.gender;
    return filters;
  }

  /**
   * Generate CSV string.
   */
  generateCsv(rows: ExportRow[], query: ExportQueryDto): string {
    const now = new Date().toISOString();
    const filters = this.describeFilters(query);
    const filterDesc = Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ') || 'none';

    // Header metadata as comments
    const meta = [
      '# African Youth Observatory — Data Export',
      `# Generated: ${now}`,
      `# Filters: ${filterDesc}`,
      '# Source: africanyouthobservatory.org',
      '# License: CC BY 4.0',
      '',
    ].join('\n');

    const headers = ['Country', 'ISO Code', 'Region', 'Indicator', 'Theme', 'Year', 'Value', 'Unit', 'Gender', 'Age Group', 'Source', 'Confidence', 'Is Estimate'];

    // Filter columns if specified
    let selectedHeaders = headers;
    if (query.columns) {
      const cols = query.columns.split(',').map((c) => c.trim().toLowerCase());
      selectedHeaders = headers.filter((h) =>
        cols.includes(h.toLowerCase().replace(/\s+/g, '_')),
      );
      if (selectedHeaders.length === 0) selectedHeaders = headers;
    }

    const headerIndices = selectedHeaders.map((h) => headers.indexOf(h));

    const csvEscape = (val: unknown): string => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const dataRows = rows.map((row) => {
      const allValues = [
        row.country,
        row.isoCode,
        row.region,
        row.indicator,
        row.theme,
        row.year,
        row.value,
        row.unit,
        row.gender,
        row.ageGroup,
        row.source,
        row.confidence,
        row.isEstimate,
      ];
      return headerIndices.map((i) => csvEscape(allValues[i])).join(',');
    });

    // BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    return bom + meta + selectedHeaders.join(',') + '\n' + dataRows.join('\n') + '\n';
  }

  /**
   * Generate JSON export.
   */
  generateJson(rows: ExportRow[], query: ExportQueryDto): string {
    const now = new Date().toISOString();
    const output = {
      metadata: {
        platform: 'African Youth Observatory',
        exportDate: now,
        filters: this.describeFilters(query),
        recordCount: rows.length,
        source: 'africanyouthobservatory.org',
        license: 'CC BY 4.0',
      },
      data: rows,
    };
    return JSON.stringify(output, null, 2);
  }

  /**
   * Generate SpreadsheetML XML (opens in Excel without any npm dependency).
   */
  generateExcel(rows: ExportRow[], query: ExportQueryDto): string {
    const now = new Date().toISOString();
    const filters = this.describeFilters(query);

    const escXml = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const headers = ['Country', 'ISO Code', 'Region', 'Indicator', 'Theme', 'Year', 'Value', 'Unit', 'Gender', 'Age Group', 'Source', 'Confidence', 'Is Estimate'];

    // Build header row
    const headerRow = `<Row ss:StyleID="Header">${headers.map((h) => `<Cell><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')}</Row>`;

    // Build data rows
    const dataRows = rows.map((row) => {
      const vals = [
        { v: row.country, t: 'String' },
        { v: row.isoCode, t: 'String' },
        { v: row.region, t: 'String' },
        { v: row.indicator, t: 'String' },
        { v: row.theme, t: 'String' },
        { v: row.year, t: 'Number' },
        { v: row.value, t: 'Number' },
        { v: row.unit, t: 'String' },
        { v: row.gender, t: 'String' },
        { v: row.ageGroup, t: 'String' },
        { v: row.source, t: 'String' },
        { v: row.confidence, t: 'Number' },
        { v: row.isEstimate ? 'Yes' : 'No', t: 'String' },
      ];
      return `<Row>${vals.map((c) => `<Cell><Data ss:Type="${c.t}">${escXml(c.v)}</Data></Cell>`).join('')}</Row>`;
    });

    // Metadata sheet
    const metaRows = [
      ['Platform', 'African Youth Observatory'],
      ['Export Date', now],
      ['Record Count', String(rows.length)],
      ['Source', 'africanyouthobservatory.org'],
      ['License', 'CC BY 4.0'],
      ...Object.entries(filters).map(([k, v]) => [`Filter: ${k}`, v]),
    ];
    const metaXml = metaRows
      .map(
        ([k, v]) =>
          `<Row><Cell><Data ss:Type="String">${escXml(k)}</Data></Cell><Cell><Data ss:Type="String">${escXml(v)}</Data></Cell></Row>`,
      )
      .join('\n');

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"/>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1B5E20" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Data">
    <Table>
      ${headerRow}
      ${dataRows.join('\n      ')}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Metadata">
    <Table>
      ${metaXml}
    </Table>
  </Worksheet>
</Workbook>`;
  }

  /**
   * Generate a basic country profile PDF-like HTML document.
   * Returns an HTML string that can be downloaded and printed to PDF.
   * (Full PDF generation with pdfkit can be added later without schema changes.)
   */
  async generateCountryReport(countryId: string): Promise<string> {
    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
    });

    if (!country) return '<html><body>Country not found</body></html>';

    // Get youth index
    const youthIndex = await this.prisma.youthIndexScore.findFirst({
      where: { countryId },
      orderBy: { year: 'desc' },
    });

    // Get top indicators
    const indicators = await this.prisma.indicatorValue.findMany({
      where: { countryId, gender: 'TOTAL' },
      include: {
        indicator: { select: { name: true, unit: true } },
      },
      orderBy: { year: 'desc' },
      take: 20,
    });

    const now = new Date().toISOString().split('T')[0];

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Country Profile: ${escHtml(country.name)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #1B5E20; border-bottom: 3px solid #1B5E20; padding-bottom: 10px; }
    h2 { color: #2E7D32; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #E8F5E9; font-weight: bold; }
    .meta { color: #666; font-size: 0.9em; }
    .score { font-size: 1.3em; font-weight: bold; color: #1B5E20; }
    .tier { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; }
    .tier-HIGH { background: #C8E6C9; color: #1B5E20; }
    .tier-MEDIUM_HIGH { background: #DCEDC8; color: #33691E; }
    .tier-MEDIUM { background: #FFF9C4; color: #F57F17; }
    .tier-MEDIUM_LOW { background: #FFE0B2; color: #E65100; }
    .tier-LOW { background: #FFCDD2; color: #B71C1C; }
    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 0.8em; }
  </style>
</head>
<body>
  <h1>${country.flagEmoji || ''} Country Profile: ${escHtml(country.name)}</h1>
  <p class="meta">African Youth Observatory — Generated ${now}</p>

  <h2>Country Overview</h2>
  <table>
    <tr><th>Name</th><td>${escHtml(country.name)}</td></tr>
    <tr><th>Capital</th><td>${escHtml(country.capital)}</td></tr>
    <tr><th>Region</th><td>${country.region.replace(/_/g, ' ')}</td></tr>
    <tr><th>ISO Code</th><td>${country.isoCode3}</td></tr>
    <tr><th>Population</th><td>${Number(country.population).toLocaleString()}</td></tr>
    <tr><th>Youth Population</th><td>${Number(country.youthPopulation).toLocaleString()}</td></tr>
    <tr><th>Languages</th><td>${country.languages.join(', ')}</td></tr>
  </table>

  ${
    youthIndex
      ? `<h2>Youth Index Score (${youthIndex.year})</h2>
  <p>Overall Score: <span class="score">${youthIndex.overallScore.toFixed(2)}</span> / 100</p>
  <p>Rank: <strong>#${youthIndex.rank}</strong> of 54 &nbsp; | &nbsp; Tier: <span class="tier tier-${youthIndex.tier}">${youthIndex.tier.replace(/_/g, ' ')}</span></p>
  <table>
    <tr><th>Dimension</th><th>Score</th></tr>
    ${EXPORT_THEME_ORDER.map((slug) => {
      const d = (youthIndex.dimensionScores && typeof youthIndex.dimensionScores === 'object')
        ? (youthIndex.dimensionScores as Record<string, number>)
        : {};
      const score = typeof d[slug] === 'number' ? d[slug] : 50;
      return `<tr><td>${EXPORT_THEME_LABELS[slug]}</td><td>${score.toFixed(2)}</td></tr>`;
    }).join('\n    ')}
  </table>`
      : '<h2>Youth Index Score</h2><p>No index data available yet. Run compute-all to generate.</p>'
  }

  <h2>Key Indicators</h2>
  <table>
    <tr><th>Indicator</th><th>Value</th><th>Unit</th><th>Year</th></tr>
    ${indicators
      .map(
        (v) =>
          `<tr><td>${escHtml(v.indicator.name)}</td><td>${v.value.toFixed(2)}</td><td>${v.indicator.unit}</td><td>${v.year}</td></tr>`,
      )
      .join('\n    ')}
  </table>

  <footer>
    Source: africanyouthobservatory.org | Data as of ${indicators[0]?.year || 'N/A'} | License: CC BY 4.0
  </footer>
</body>
</html>`;

    return html;
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
