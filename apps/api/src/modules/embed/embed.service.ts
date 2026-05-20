import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';

@Injectable()
export class EmbedService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Generate an embeddable bar or line chart as self-contained HTML.
   */
  async generateChart(
    type: 'bar' | 'line',
    indicatorSlug: string,
    options: {
      year?: number;
      country?: string;
      limit?: number;
      sort?: 'asc' | 'desc';
      theme?: 'light' | 'dark';
      yearStart?: number;
      yearEnd?: number;
    },
  ): Promise<string> {
    const cacheKey = this.cache.buildKey('embed:chart', { type, indicatorSlug, ...options });
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const indicator = await this.prisma.indicator.findFirst({
      where: { slug: indicatorSlug },
      select: { id: true, name: true, unit: true },
    });
    if (!indicator) throw new NotFoundException(`Indicator "${indicatorSlug}" not found`);

    let html: string;

    if (type === 'bar') {
      html = await this.generateBarChart(indicator, options);
    } else if (type === 'line') {
      if (!options.country) {
        throw new BadRequestException('country parameter is required for line charts');
      }
      html = await this.generateLineChart(indicator, options);
    } else {
      throw new BadRequestException('Invalid chart type. Use "bar" or "line".');
    }

    this.cache.set(cacheKey, html, 1800); // 30 min cache
    return html;
  }

  /**
   * Generate an embeddable stat card as self-contained HTML.
   */
  async generateStatCard(
    indicatorSlug: string,
    countryCode: string,
    year?: number,
    theme: 'light' | 'dark' = 'light',
  ): Promise<string> {
    const cacheKey = this.cache.buildKey('embed:stat', { indicatorSlug, countryCode, year, theme });
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const indicator = await this.prisma.indicator.findFirst({
      where: { slug: indicatorSlug },
      select: { id: true, name: true, unit: true },
    });
    if (!indicator) throw new NotFoundException(`Indicator "${indicatorSlug}" not found`);

    const country = await this.prisma.country.findFirst({
      where: { isoCode3: countryCode.toUpperCase() },
      select: { id: true, name: true, flagEmoji: true },
    });
    if (!country) throw new NotFoundException(`Country "${countryCode}" not found`);

    // Get value for the specified or latest year
    const value = await this.prisma.indicatorValue.findFirst({
      where: {
        countryId: country.id,
        indicatorId: indicator.id,
        gender: 'TOTAL',
        ...(year ? { year } : {}),
      },
      orderBy: { year: 'desc' },
      select: { value: true, year: true },
    });

    // Get previous year value for trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (value) {
      const prevValue = await this.prisma.indicatorValue.findFirst({
        where: {
          countryId: country.id,
          indicatorId: indicator.id,
          gender: 'TOTAL',
          year: value.year - 1,
        },
        select: { value: true },
      });
      if (prevValue) {
        const diff = value.value - prevValue.value;
        if (diff > 0.5) trend = 'up';
        else if (diff < -0.5) trend = 'down';
      }
    }

    const isDark = theme === 'dark';
    const trendArrow = trend === 'up' ? '&#x25B2;' : trend === 'down' ? '&#x25BC;' : '&#x25CF;';
    const trendColor = trend === 'up' ? '#4CAF50' : trend === 'down' ? '#F44336' : '#9E9E9E';
    const unitLabel = this.formatUnit(indicator.unit);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${isDark ? '#1a1a2e' : '#ffffff'};color:${isDark ? '#e0e0e0' : '#333'};padding:16px;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:${isDark ? '#16213e' : '#f8f9fa'};border-radius:12px;padding:20px 24px;max-width:300px;width:100%;border:1px solid ${isDark ? '#2a2a4a' : '#e0e0e0'}}
    .country{font-size:14px;color:${isDark ? '#aaa' : '#666'};margin-bottom:4px}
    .flag{font-size:20px;margin-right:6px}
    .indicator{font-size:13px;color:${isDark ? '#888' : '#888'};margin-bottom:12px}
    .value{font-size:36px;font-weight:700;color:${isDark ? '#fff' : '#1B5E20'}}
    .unit{font-size:14px;color:${isDark ? '#aaa' : '#666'};margin-left:4px}
    .meta{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12px;color:${isDark ? '#888' : '#999'}}
    .trend{font-size:14px}
    .watermark{text-align:right;font-size:10px;color:#999;margin-top:12px}
    .watermark a{color:#1B5E20;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="country"><span class="flag">${country.flagEmoji || ''}</span>${country.name}</div>
    <div class="indicator">${indicator.name}</div>
    <div class="value">${value ? this.formatValue(value.value, indicator.unit) : 'N/A'}<span class="unit">${unitLabel}</span></div>
    <div class="meta">
      <span>${value ? value.year : 'No data'}</span>
      <span class="trend" style="color:${trendColor}">${trendArrow}</span>
    </div>
    <div class="watermark">Data: <a href="https://africanyouthobservatory.org" target="_blank">African Youth Observatory</a></div>
  </div>
</body>
</html>`;

    this.cache.set(cacheKey, html, 1800);
    return html;
  }

  /**
   * Generate an embeddable SVG map.
   */
  async generateMap(
    indicatorSlug: string,
    year?: number,
    theme: 'light' | 'dark' = 'light',
  ): Promise<string> {
    const cacheKey = this.cache.buildKey('embed:map', { indicatorSlug, year, theme });
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const indicator = await this.prisma.indicator.findFirst({
      where: { slug: indicatorSlug },
      select: { id: true, name: true, unit: true },
    });
    if (!indicator) throw new NotFoundException(`Indicator "${indicatorSlug}" not found`);

    // Get latest year if not specified
    let targetYear = year;
    if (!targetYear) {
      const latest = await this.prisma.indicatorValue.findFirst({
        where: { indicatorId: indicator.id, gender: 'TOTAL' },
        orderBy: { year: 'desc' },
        select: { year: true },
      });
      targetYear = latest?.year || 2023;
    }

    // Get values for all countries
    const values = await this.prisma.indicatorValue.findMany({
      where: { indicatorId: indicator.id, year: targetYear, gender: 'TOTAL' },
      include: { country: { select: { name: true, isoCode3: true, region: true } } },
    });

    const vals = values.map((v) => v.value);
    const minVal = vals.length > 0 ? Math.min(...vals) : 0;
    const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
    const range = maxVal - minVal || 1;

    const isDark = theme === 'dark';

    // Build simple grid map (region-based layout)
    const regionPositions: Record<string, { x: number; y: number }> = {
      NORTH_AFRICA: { x: 0, y: 0 },
      WEST_AFRICA: { x: 0, y: 1 },
      CENTRAL_AFRICA: { x: 1, y: 1 },
      EAST_AFRICA: { x: 2, y: 1 },
      SOUTHERN_AFRICA: { x: 1, y: 2 },
    };

    let svgRects = '';
    const cellW = 36;
    const cellH = 24;
    const padding = 2;
    const regionCounts: Record<string, number> = {};

    for (const v of values) {
      const region = v.country.region;
      if (!regionCounts[region]) regionCounts[region] = 0;
      const pos = regionPositions[region] || { x: 0, y: 0 };
      const col = regionCounts[region] % 5;
      const row = Math.floor(regionCounts[region] / 5);
      regionCounts[region]++;

      const norm = (v.value - minVal) / range;
      const color = this.valueToColor(norm);

      const x = pos.x * (cellW * 5 + 20) + col * (cellW + padding) + 10;
      const y = pos.y * (cellH * 4 + 30) + row * (cellH + padding) + 30;

      svgRects += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${color}" rx="3">
        <title>${v.country.name}: ${this.formatValue(v.value, indicator.unit)}</title>
      </rect>
      <text x="${x + cellW / 2}" y="${y + cellH / 2 + 4}" text-anchor="middle" font-size="8" fill="${isDark ? '#fff' : '#333'}">${v.country.isoCode3}</text>`;
    }

    // Region labels
    let regionLabels = '';
    for (const [region, pos] of Object.entries(regionPositions)) {
      const x = pos.x * (cellW * 5 + 20) + 10;
      const y = pos.y * (cellH * 4 + 30) + 22;
      const label = region.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
      regionLabels += `<text x="${x}" y="${y}" font-size="10" font-weight="bold" fill="${isDark ? '#ccc' : '#555'}">${label}</text>`;
    }

    const svgWidth = 600;
    const svgHeight = 400;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${isDark ? '#1a1a2e' : '#ffffff'};padding:12px}
    h3{color:${isDark ? '#e0e0e0' : '#333'};font-size:14px;margin-bottom:8px}
    .legend{display:flex;align-items:center;gap:4px;margin-top:8px;font-size:10px;color:${isDark ? '#aaa' : '#666'}}
    .legend-bar{width:120px;height:10px;border-radius:3px;background:linear-gradient(to right,#F44336,#FF9800,#FFEB3B,#8BC34A,#4CAF50)}
    .watermark{text-align:right;font-size:10px;color:#999;margin-top:8px}
    .watermark a{color:#1B5E20;text-decoration:none}
  </style>
</head>
<body>
  <h3>${indicator.name} (${targetYear})</h3>
  <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" style="max-width:${svgWidth}px">
    ${regionLabels}
    ${svgRects}
  </svg>
  <div class="legend">
    <span>Low (${this.formatValue(minVal, indicator.unit)})</span>
    <div class="legend-bar"></div>
    <span>High (${this.formatValue(maxVal, indicator.unit)})</span>
  </div>
  <div class="watermark">Data: <a href="https://africanyouthobservatory.org" target="_blank">African Youth Observatory</a></div>
</body>
</html>`;

    this.cache.set(cacheKey, html, 1800);
    return html;
  }

  /**
   * Get embed configuration and example codes.
   */
  getEmbedConfig() {
    const baseUrl = process.env.VITE_API_URL || 'http://localhost:3001/api';

    return {
      baseUrl: `${baseUrl}/embed`,
      examples: {
        barChart: `<iframe src="${baseUrl}/embed/chart?type=bar&indicator=youth-unemployment-rate&year=2023&limit=10" width="600" height="400" frameborder="0"></iframe>`,
        lineChart: `<iframe src="${baseUrl}/embed/chart?type=line&indicator=youth-unemployment-rate&country=NGA&yearStart=2010&yearEnd=2023" width="600" height="300" frameborder="0"></iframe>`,
        statCard: `<iframe src="${baseUrl}/embed/stat?indicator=youth-unemployment-rate&country=NGA&year=2023" width="300" height="200" frameborder="0"></iframe>`,
        map: `<iframe src="${baseUrl}/embed/map?indicator=youth-unemployment-rate&year=2023" width="600" height="450" frameborder="0"></iframe>`,
      },
      parameters: {
        type: 'bar | line (chart endpoint only)',
        indicator: 'Indicator slug (see GET /api/indicators for list)',
        country: 'ISO3 country code (e.g., NGA, KEN, ZAF)',
        year: 'Data year (default: latest available)',
        limit: 'Number of countries for bar chart (default: 10, max: 54)',
        sort: 'asc | desc (bar chart, default: desc)',
        theme: 'light | dark (default: light)',
        yearStart: 'Start year (line chart)',
        yearEnd: 'End year (line chart)',
      },
      notes: [
        'All embed endpoints return self-contained HTML designed for iframe embedding.',
        'Charts use Chart.js loaded from CDN.',
        'Data is cached for 30 minutes.',
        'Include the AYO watermark when embedding.',
      ],
    };
  }

  // ── Private Helpers ─────────────────────────────────────────

  private async generateBarChart(
    indicator: { id: string; name: string; unit: string },
    options: { year?: number; limit?: number; sort?: string; theme?: string },
  ): Promise<string> {
    const { limit = 10, sort = 'desc', theme = 'light' } = options;

    // Get latest year
    let targetYear = options.year;
    if (!targetYear) {
      const latest = await this.prisma.indicatorValue.findFirst({
        where: { indicatorId: indicator.id, gender: 'TOTAL' },
        orderBy: { year: 'desc' },
        select: { year: true },
      });
      targetYear = latest?.year || 2023;
    }

    const values = await this.prisma.indicatorValue.findMany({
      where: { indicatorId: indicator.id, year: targetYear, gender: 'TOTAL' },
      include: { country: { select: { name: true, isoCode3: true } } },
      orderBy: { value: sort === 'asc' ? 'asc' : 'desc' },
      take: limit,
    });

    const isDark = theme === 'dark';
    const labels = values.map((v) => v.country.name);
    const data = values.map((v) => v.value);

    const chartConfig = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: indicator.name,
          data,
          backgroundColor: 'rgba(27, 94, 32, 0.7)',
          borderColor: 'rgba(27, 94, 32, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `${indicator.name} (${targetYear})`,
            color: isDark ? '#e0e0e0' : '#333',
          },
        },
        scales: {
          x: { ticks: { color: isDark ? '#aaa' : '#666', maxRotation: 45 } },
          y: { ticks: { color: isDark ? '#aaa' : '#666' }, grid: { color: isDark ? '#333' : '#eee' } },
        },
      },
    };

    return this.wrapChart(chartConfig, isDark);
  }

  private async generateLineChart(
    indicator: { id: string; name: string; unit: string },
    options: { country?: string; yearStart?: number; yearEnd?: number; theme?: string },
  ): Promise<string> {
    const { country: countryCode, yearStart = 2010, yearEnd = 2024, theme = 'light' } = options;

    const countryRecord = await this.prisma.country.findFirst({
      where: { isoCode3: countryCode!.toUpperCase() },
      select: { id: true, name: true },
    });
    if (!countryRecord) throw new NotFoundException(`Country "${countryCode}" not found`);

    const values = await this.prisma.indicatorValue.findMany({
      where: {
        countryId: countryRecord.id,
        indicatorId: indicator.id,
        gender: 'TOTAL',
        year: { gte: yearStart, lte: yearEnd },
      },
      orderBy: { year: 'asc' },
      select: { year: true, value: true },
    });

    const isDark = theme === 'dark';
    const labels = values.map((v) => v.year.toString());
    const data = values.map((v) => v.value);

    const chartConfig = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: indicator.name,
          data,
          borderColor: 'rgba(27, 94, 32, 1)',
          backgroundColor: 'rgba(27, 94, 32, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `${indicator.name} — ${countryRecord.name}`,
            color: isDark ? '#e0e0e0' : '#333',
          },
        },
        scales: {
          x: { ticks: { color: isDark ? '#aaa' : '#666' } },
          y: { ticks: { color: isDark ? '#aaa' : '#666' }, grid: { color: isDark ? '#333' : '#eee' } },
        },
      },
    };

    return this.wrapChart(chartConfig, isDark);
  }

  private wrapChart(chartConfig: unknown, isDark: boolean): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{margin:0;padding:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${isDark ? '#1a1a2e' : '#ffffff'};height:100vh;display:flex;flex-direction:column}
    .chart-container{flex:1;position:relative;min-height:0}
    .watermark{text-align:right;font-size:10px;color:#999;margin-top:4px;flex-shrink:0}
    .watermark a{color:#1B5E20;text-decoration:none}
  </style>
</head>
<body>
  <div class="chart-container"><canvas id="chart"></canvas></div>
  <div class="watermark">Data: <a href="https://africanyouthobservatory.org" target="_blank">African Youth Observatory</a></div>
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, ${JSON.stringify(chartConfig)});
  </script>
</body>
</html>`;
  }

  private valueToColor(normalized: number): string {
    // Red → Yellow → Green gradient
    const r = Math.round(normalized < 0.5 ? 255 : 255 * (1 - normalized) * 2);
    const g = Math.round(normalized > 0.5 ? 200 : 200 * normalized * 2);
    const b = Math.round(50);
    return `rgb(${r},${g},${b})`;
  }

  private formatValue(value: number, unit: string): string {
    if (unit === 'PERCENTAGE' || unit === 'RATE') return `${Math.round(value * 10) / 10}%`;
    if (unit === 'CURRENCY') return `$${Math.round(value)}`;
    if (unit === 'YEARS') return `${Math.round(value * 10) / 10}`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return `${Math.round(value * 100) / 100}`;
  }

  private formatUnit(unit: string): string {
    const map: Record<string, string> = {
      PERCENTAGE: '%',
      RATE: '%',
      INDEX: 'idx',
      SCORE: 'pts',
      NUMBER: '',
      CURRENCY: 'USD',
      YEARS: 'yrs',
      RATIO: '',
    };
    return map[unit] || '';
  }
}
