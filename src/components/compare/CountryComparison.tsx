import React, { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Download, BarChart3, Hexagon, Filter, X, Calendar,
  TrendingUp, ArrowDownUp, Loader2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
  ComposedChart,
  Scatter,
} from 'recharts';
import CountryFlag from '@/components/CountryFlag';
import { useToast } from '@/hooks/use-toast';
import {
  api,
  type Country,
  type Theme,
  type Indicator,
  type CompareCountriesResult,
  type CompareThemesResult,
} from '@/lib/api-client';

const CHART_COLORS = ['#22C55E', '#F59E0B', '#3B82F6', '#A855F7', '#F43F5E'];

type ChartType = 'bar' | 'horizontal-bar' | 'lollipop' | 'radar';

// Backend default data year is 2023. Offer a small window around it.
const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
const DEFAULT_YEAR = 2023;
const MAX_COUNTRIES = 5;

/* ─────────────────────────────────────────────────────────────────────────
   Real-data shapes used by the charts/table/PNG. Everything below is derived
   ONLY from data fetched from the backend — no fabrication.
   ──────────────────────────────────────────────────────────────────────── */

// One row per selected country for the currently-selected indicator.
interface IndicatorRow {
  country: string;          // display name
  countryShort: string;     // truncated for axis labels
  value: number | null;     // raw indicator value (null = no data)
  unit: string;
  rank: number | null;
  percentile: number | null;
  regionalAverage: number | null;
  continentalAverage: number | null;
}

// One radar axis (theme) with per-country averageScore (0-100).
interface RadarRow {
  dimension: string;
  values: Record<string, number | null>;
}

/* ─────────────────────────────────────────────────────────────────────────
   renderComparisonPng — draws the comparison card directly to a Canvas using
   the native 2D API from REAL fetched data passed in by the component.
   ──────────────────────────────────────────────────────────────────────── */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Format a raw value for display (handles null and unit suffix).
function fmtValue(value: number | null, unit: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  const u = unit && unit !== '%' ? ` ${unit}` : (unit === '%' ? '%' : '');
  return `${rounded}${u}`;
}

// Scale a raw value into a 0-100 chart height using the max across the row.
// For percentage-style indicators (0-100) this is effectively identity; for
// large-magnitude indicators it keeps bars proportional and on-canvas.
function chartScale(value: number | null, maxValue: number): number {
  if (value === null || maxValue <= 0) return 0;
  return Math.max(0, Math.min(100, (value / maxValue) * 100));
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  W: number,
  startY: number,
  selectedTheme: string,
  selectedIndicator: string,
  selectedYear: number,
  selectedCountries: string[],
): number {
  const PAD = 48;
  let y = startY;

  roundRect(ctx, PAD, y, 44, 44, 8);
  ctx.fillStyle = '#D4A017';
  ctx.fill();
  ctx.fillStyle = '#0a0e14';
  ctx.font = '700 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AYO', PAD + 22, y + 22);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#7d8590';
  ctx.font = '600 12px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText('AFRICAN YOUTH OBSERVATORY', PAD + 56, y + 17);
  ctx.fillStyle = '#a8a29e';
  ctx.font = '400 13px system-ui';
  ctx.fillText(`Country Comparison · ${selectedTheme}`, PAD + 56, y + 36);

  y += 64;

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const titleLines = wrapLines(ctx, selectedIndicator || 'Comparison', W - PAD * 2);
  for (const line of titleLines) {
    y += 42;
    ctx.fillText(line, PAD, y);
  }

  y += 32;
  ctx.fillStyle = '#a8a29e';
  ctx.font = '400 16px system-ui';
  const countText = selectedCountries.length === 1 ? '1 country' : `${selectedCountries.length} countries`;
  ctx.fillText(`${countText} · Year ${selectedYear}`, PAD, y);

  y += 18;
  let pillX = PAD;
  let pillY = y + 4;
  const pillH = 30;
  const pillGap = 8;
  ctx.font = '600 13px system-ui';
  for (let i = 0; i < selectedCountries.length; i++) {
    const c = selectedCountries[i];
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const dotW = 8;
    const padX = 12;
    const textW = ctx.measureText(c).width;
    const pillW = padX + dotW + 6 + textW + padX;

    if (pillX + pillW > W - PAD) {
      pillX = PAD;
      pillY += pillH + pillGap;
    }

    ctx.fillStyle = color + '1f';
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = color + '55';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pillX + padX + 4, pillY + pillH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(c, pillX + padX + dotW + 6, pillY + pillH / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    pillX += pillW + pillGap;
  }
  return pillY + pillH + 24;
}

function drawChartCard(
  ctx: CanvasRenderingContext2D,
  W: number,
  startY: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const PAD = 48;
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  roundRect(ctx, PAD, startY, W - PAD * 2, height, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  return { x: PAD + 18, y: startY + 18, w: W - PAD * 2 - 36, h: height - 36 };
}

function drawVerticalBars(
  ctx: CanvasRenderingContext2D,
  area: { x: number; y: number; w: number; h: number },
  values: IndicatorRow[],
) {
  const { x, y, w, h } = area;
  const padBottom = 36;
  const padTop = 28;
  const padLeft = 60;
  const chartX = x + padLeft;
  const chartY = y + padTop;
  const chartW = w - padLeft;
  const chartH = h - padBottom - padTop;

  const maxValue = Math.max(0, ...values.map((v) => (v.value ?? 0)));

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#7d8590';
  ctx.font = '500 12px system-ui';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const yy = chartY + chartH - (chartH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(chartX, yy);
    ctx.lineTo(chartX + chartW, yy);
    ctx.stroke();
    const tickVal = (maxValue * i) / 5;
    ctx.fillText(`${Math.round(tickVal * 10) / 10}`, chartX - 8, yy);
  }

  const n = values.length;
  if (n === 0) return;
  const slot = chartW / n;
  const barW = Math.min(80, slot * 0.55);
  values.forEach((v, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const slotCenter = chartX + slot * (i + 0.5);
    const barX = slotCenter - barW / 2;
    const pct = chartScale(v.value, maxValue);
    const barH = (pct / 100) * chartH;
    const barY = chartY + chartH - barH;

    if (v.value === null) {
      // No-data marker: hollow baseline tick + "—"
      ctx.fillStyle = '#7d8590';
      ctx.font = '600 13px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('—', slotCenter, chartY + chartH - 4);
    } else {
      ctx.fillStyle = color;
      roundRect(ctx, barX, barY, barW, barH, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(fmtValue(v.value, v.unit), slotCenter, barY - 6);
    }

    const label = v.country.length > 12 ? v.country.slice(0, 11) + '…' : v.country;
    ctx.fillStyle = '#7d8590';
    ctx.font = '500 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, slotCenter, chartY + chartH + 10);
  });
}

function drawHorizontalBars(
  ctx: CanvasRenderingContext2D,
  area: { x: number; y: number; w: number; h: number },
  values: IndicatorRow[],
  variant: 'bar' | 'lollipop',
) {
  const sorted = [...values].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const maxValue = Math.max(0, ...values.map((v) => (v.value ?? 0)));
  const { x, y, w, h } = area;
  const padTop = 16;
  const padBottom = 28;
  const padLeft = 200;
  const padRight = 80;
  const chartX = x + padLeft;
  const chartY = y + padTop;
  const chartW = w - padLeft - padRight;
  const chartH = h - padBottom - padTop;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#7d8590';
  ctx.font = '500 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 5; i++) {
    const xx = chartX + (chartW * i) / 5;
    ctx.beginPath();
    ctx.moveTo(xx, chartY);
    ctx.lineTo(xx, chartY + chartH);
    ctx.stroke();
    const tickVal = (maxValue * i) / 5;
    ctx.fillText(`${Math.round(tickVal * 10) / 10}`, xx, chartY + chartH + 8);
  }

  const n = sorted.length;
  if (n === 0) return;
  const rowH = chartH / n;
  const barH = Math.min(44, rowH * 0.6);
  sorted.forEach((v, i) => {
    const color = CHART_COLORS[values.findIndex((d) => d.country === v.country) % CHART_COLORS.length];
    const cy = chartY + rowH * (i + 0.5);
    const pct = chartScale(v.value, maxValue);
    const barW = (pct / 100) * chartW;

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '600 14px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const lbl = v.country.length > 22 ? v.country.slice(0, 21) + '…' : v.country;
    ctx.fillText(lbl, chartX - 14, cy);

    if (v.value === null) {
      ctx.fillStyle = '#7d8590';
      ctx.font = '600 13px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('No data', chartX + 6, cy);
      return;
    }

    if (variant === 'bar') {
      ctx.fillStyle = color;
      roundRect(ctx, chartX, cy - barH / 2, Math.max(barW, 1), barH, 8);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, chartX, cy - 1.5, Math.max(barW, 1), 3, 1.5);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(chartX + barW, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0e14';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmtValue(v.value, v.unit), chartX + barW + (variant === 'lollipop' ? 22 : 10), cy);
  });
}

function drawRadar(
  ctx: CanvasRenderingContext2D,
  area: { x: number; y: number; w: number; h: number },
  countries: string[],
  data: RadarRow[],
) {
  const { x, y, w, h } = area;
  const legendH = 36;
  const radarH = h - legendH;
  const cx = x + w / 2;
  const cy = y + radarH / 2;
  const radius = Math.min(w, radarH) * 0.36;

  if (data.length === 0) {
    ctx.fillStyle = '#7d8590';
    ctx.font = '500 15px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No theme data available', cx, cy);
    return;
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let level = 1; level <= 4; level++) {
    const r = (radius * level) / 4;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / data.length;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '500 13px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < data.length; i++) {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / data.length;
    const px = cx + radius * Math.cos(a);
    const py = cy + radius * Math.sin(a);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    const lx = cx + (radius + 24) * Math.cos(a);
    const ly = cy + (radius + 18) * Math.sin(a);
    ctx.fillText(data[i].dimension, lx, ly);
  }

  countries.forEach((country, ci) => {
    const color = CHART_COLORS[ci % CHART_COLORS.length];
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < data.length; i++) {
      const v = data[i].values[country] ?? 0;
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / data.length;
      const r = (radius * v) / 100;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color + '38';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    for (let i = 0; i < data.length; i++) {
      const v = data[i].values[country] ?? 0;
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / data.length;
      const r = (radius * v) / 100;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const legendY = y + radarH + 12;
  ctx.font = '500 13px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let legX = x + 16;
  countries.forEach((country, ci) => {
    const color = CHART_COLORS[ci % CHART_COLORS.length];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legX + 6, legendY + 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    const tw = ctx.measureText(country).width;
    ctx.fillText(country, legX + 18, legendY + 7);
    legX += 18 + tw + 16;
  });
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  W: number,
  startY: number,
  rows: IndicatorRow[],
  selectedYear: number,
): number {
  const PAD = 48;
  let y = startY;
  ctx.fillStyle = '#7d8590';
  ctx.font = '600 11px system-ui';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('COUNTRY', PAD + 4, y + 14);
  ctx.textAlign = 'right';
  ctx.fillText('VALUE', W - PAD - 200, y + 14);
  ctx.fillText('RANK', W - PAD - 110, y + 14);
  ctx.fillText('YEAR', W - PAD - 4, y + 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(PAD, y + 22);
  ctx.lineTo(W - PAD, y + 22);
  ctx.stroke();
  y += 22;

  rows.forEach((row, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    y += 38;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(PAD + 8, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(row.country, PAD + 22, y);

    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'right';
    ctx.fillStyle = row.value === null ? '#7d8590' : '#ffffff';
    ctx.fillText(fmtValue(row.value, row.unit), W - PAD - 200, y);

    ctx.fillStyle = '#a8a29e';
    ctx.font = '500 14px system-ui';
    ctx.fillText(row.rank !== null ? `#${row.rank}` : '—', W - PAD - 110, y);

    ctx.fillStyle = '#7d8590';
    ctx.fillText(String(selectedYear), W - PAD - 4, y);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(PAD, y + 8);
    ctx.lineTo(W - PAD, y + 8);
    ctx.stroke();
  });

  return y + 8;
}

function drawFooter(ctx: CanvasRenderingContext2D, W: number, startY: number): number {
  const PAD = 48;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, startY);
  ctx.lineTo(W, startY);
  ctx.stroke();
  ctx.fillStyle = '#a8a29e';
  ctx.font = '500 12px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('africanyouthobservatory.org', PAD, startY + 26);
  ctx.fillStyle = '#7d8590';
  ctx.font = '500 11px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Source: African Youth Observatory database', W - PAD, startY + 26);
  return startY + 52;
}

function renderComparisonPng({
  selectedCountries,
  selectedIndicator,
  selectedTheme,
  selectedYear,
  chartType,
  indicatorRows,
  radarData,
}: {
  selectedCountries: string[];
  selectedIndicator: string;
  selectedTheme: string;
  selectedYear: number;
  chartType: ChartType;
  indicatorRows: IndicatorRow[];
  radarData: RadarRow[];
}): string {
  const W = 1080;
  const SCALE = 2;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = W;
  tempCanvas.height = 2400;
  const tempCtx = tempCanvas.getContext('2d')!;
  const headerEnd = drawHeader(tempCtx, W, 32, selectedTheme, selectedIndicator, selectedYear, selectedCountries);

  const chartHeight = 600;
  const chartEnd = headerEnd + chartHeight;
  const tableStart = chartEnd + 24;
  const tableHeight = 22 + selectedCountries.length * 38 + 8;
  const footerStart = tableStart + tableHeight + 16;
  const totalH = footerStart + 52;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, W, totalH);

  const stripe = ctx.createLinearGradient(0, 0, W, 0);
  stripe.addColorStop(0, '#22C55E');
  stripe.addColorStop(0.5, '#D4A017');
  stripe.addColorStop(1, '#F43F5E');
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, W, 6);

  drawHeader(ctx, W, 32, selectedTheme, selectedIndicator, selectedYear, selectedCountries);

  const chartArea = drawChartCard(ctx, W, headerEnd, chartHeight);
  if (chartType === 'bar') {
    drawVerticalBars(ctx, chartArea, indicatorRows);
  } else if (chartType === 'horizontal-bar') {
    drawHorizontalBars(ctx, chartArea, indicatorRows, 'bar');
  } else if (chartType === 'lollipop') {
    drawHorizontalBars(ctx, chartArea, indicatorRows, 'lollipop');
  } else {
    drawRadar(ctx, chartArea, selectedCountries, radarData);
  }

  drawTable(ctx, W, tableStart, indicatorRows, selectedYear);
  drawFooter(ctx, W, footerStart);

  return canvas.toDataURL('image/png');
}


/** Comparison chart sub-component — renders REAL fetched data. */
function ComparisonChart({
  selectedCountries,
  selectedIndicator,
  chartType,
  indicatorRows,
  radarData,
  isLoading,
  isError,
}: {
  selectedCountries: string[];
  selectedIndicator: string;
  chartType: ChartType;
  indicatorRows: IndicatorRow[];
  radarData: RadarRow[];
  isLoading: boolean;
  isError: boolean;
}) {
  // Recharts-friendly bar dataset. Null values are coerced to 0 for layout but
  // labelled honestly via the tooltip/table; we keep a hasData flag.
  const barData = useMemo(
    () =>
      indicatorRows.map((r) => ({
        country: r.country,
        countryShort: r.country.length > 12 ? r.country.slice(0, 11) + '…' : r.country,
        value: r.value,
        plotValue: r.value ?? 0,
        unit: r.unit,
      })),
    [indicatorRows],
  );
  const sortedBarData = useMemo(
    () => [...barData].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    [barData],
  );

  // Recharts radar dataset: one row per dimension, key per country.
  const radarChartData = useMemo(
    () =>
      radarData.map((row) => {
        const entry: Record<string, string | number | null> = { dimension: row.dimension };
        selectedCountries.forEach((c) => {
          entry[c] = row.values[c] ?? null;
        });
        return entry;
      }),
    [radarData, selectedCountries],
  );

  const containerClass =
    'h-[320px] sm:h-[380px] md:h-[440px] border border-gray-800 rounded-xl bg-black/30 p-2 sm:p-4';

  if (selectedCountries.length === 0 || !selectedIndicator) {
    return (
      <div className={`${containerClass} flex items-center justify-center`}>
        <p className="text-sm text-gray-500 text-center px-4">
          {selectedCountries.length === 0
            ? 'Select countries to compare'
            : 'Select an indicator to display chart data'}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${containerClass} flex flex-col items-center justify-center gap-2`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        <p className="text-xs text-gray-500">Loading comparison data…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`${containerClass} flex items-center justify-center`}>
        <p className="text-sm text-rose-400 text-center px-4">
          Could not load comparison data. Please try again.
        </p>
      </div>
    );
  }

  const hasAnyValue =
    chartType === 'radar'
      ? radarChartData.some((row) => selectedCountries.some((c) => row[c] != null))
      : barData.some((d) => d.value != null);

  if (!hasAnyValue) {
    return (
      <div className={`${containerClass} flex items-center justify-center`}>
        <p className="text-sm text-gray-500 text-center px-4">
          No data available for this selection. Try a different year, indicator, or country.
        </p>
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: 'rgba(10,14,20,0.92)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    fontSize: '11px',
    padding: '6px 10px',
  };
  const tickStyle = { fontSize: 11, fill: 'rgba(255,255,255,0.5)' };
  const valued = barData.filter((d) => d.value != null);
  const avg = valued.length ? valued.reduce((a, b) => a + (b.value ?? 0), 0) / valued.length : 0;
  const unit = indicatorRows[0]?.unit ?? '';
  const fmtTooltip = (value: number, _name: string, props: any) => {
    const raw = props?.payload?.value;
    return [raw == null ? 'No data' : fmtValue(raw, unit), selectedIndicator];
  };

  return (
    <div className={containerClass}>
      {chartType === 'bar' && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 16, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="countryShort" tick={tickStyle} interval={0} tickLine={false} axisLine={false} />
            <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={fmtTooltip as any}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <ReferenceLine y={avg} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" label={{ value: `avg ${fmtValue(avg, unit)}`, position: 'right', fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
            <Bar dataKey="plotValue" name={selectedIndicator} radius={[6, 6, 0, 0]} maxBarSize={50}>
              {barData.map((d, i) => (
                <Cell key={i} fill={d.value == null ? 'rgba(255,255,255,0.08)' : CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartType === 'horizontal-bar' && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedBarData} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={false} />
            <YAxis dataKey="countryShort" type="category" tick={tickStyle} tickLine={false} axisLine={false} width={92} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={fmtTooltip as any}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="plotValue" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {sortedBarData.map((d, i) => (
                <Cell key={i} fill={d.value == null ? 'rgba(255,255,255,0.08)' : CHART_COLORS[barData.findIndex((b) => b.country === d.country) % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartType === 'lollipop' && (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sortedBarData} layout="vertical" margin={{ top: 6, right: 32, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={false} />
            <YAxis dataKey="countryShort" type="category" tick={tickStyle} tickLine={false} axisLine={false} width={92} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={fmtTooltip as any}
              cursor={false}
            />
            <Bar dataKey="plotValue" maxBarSize={2} fill="rgba(34,197,94,0.4)" />
            <Scatter dataKey="plotValue" shape={(props: any) => {
              const { cx, cy, payload } = props;
              if (payload.value == null) return <g />;
              const idx = sortedBarData.findIndex((d) => d.country === payload.country);
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              return (
                <g>
                  <circle cx={cx} cy={cy} r={9} fill={color} stroke="#0a0e14" strokeWidth={2} />
                  <text x={cx + 14} y={cy + 4} fill="rgba(255,255,255,0.85)" fontSize={11} fontWeight={600}>{fmtValue(payload.value, unit)}</text>
                </g>
              );
            }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {chartType === 'radar' && (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} />
            {selectedCountries.map((country, i) => (
              <Radar
                key={country}
                name={country}
                dataKey={country}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.18}
                strokeWidth={2}
                connectNulls
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ padding: '1px 0', fontSize: '11px' }}
              labelStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const CountryComparison = () => {
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(DEFAULT_YEAR);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  // ── Reference data ────────────────────────────────────────────────────────
  const { data: countriesData } = useQuery({
    queryKey: ['compare', 'countries-list'],
    queryFn: () => api.countries.list(),
    staleTime: 1000 * 60 * 10,
  });
  const allCountries: Country[] = useMemo(() => {
    const raw = (countriesData as any)?.data ?? countriesData;
    return Array.isArray(raw) ? raw : [];
  }, [countriesData]);

  const { data: themesData } = useQuery({
    queryKey: ['compare', 'themes-list'],
    queryFn: () => api.themes.list(),
    staleTime: 1000 * 60 * 10,
  });
  const allThemes: Theme[] = useMemo(() => {
    const raw = (themesData as any)?.data ?? themesData;
    return Array.isArray(raw) ? raw : [];
  }, [themesData]);

  // Default the theme to the first one once themes load.
  const effectiveThemeId = selectedThemeId || allThemes[0]?.id || '';

  const { data: indicatorsData } = useQuery({
    queryKey: ['compare', 'indicators-list', effectiveThemeId],
    queryFn: () => api.indicators.list({ themeId: effectiveThemeId }),
    enabled: !!effectiveThemeId,
    staleTime: 1000 * 60 * 10,
  });
  const availableIndicators: Indicator[] = useMemo(() => {
    const raw = (indicatorsData as any)?.data ?? indicatorsData;
    return Array.isArray(raw) ? raw : [];
  }, [indicatorsData]);

  // Resolve display helpers.
  const selectedTheme = allThemes.find((t) => t.id === effectiveThemeId);
  const selectedIndicator = availableIndicators.find((i) => i.id === selectedIndicatorId);
  const selectedCountries = useMemo(
    () =>
      selectedCountryIds
        .map((id) => allCountries.find((c) => c.id === id))
        .filter((c): c is Country => !!c),
    [selectedCountryIds, allCountries],
  );
  const selectedCountryNames = selectedCountries.map((c) => c.name);

  // ── Indicator comparison (bar + table) ──────────────────────────────────────
  const compareEnabled = selectedCountryIds.length > 0 && !!selectedIndicatorId;
  const { data: compareData, isLoading: compareLoading, isError: compareError } = useQuery<CompareCountriesResult>({
    queryKey: ['compare', 'countries', selectedCountryIds, selectedIndicatorId, selectedYear],
    queryFn: () =>
      api.compare.countries({
        countryIds: selectedCountryIds,
        indicatorIds: [selectedIndicatorId],
        year: selectedYear,
        includeRegionalAverage: true,
      }),
    enabled: compareEnabled,
  });

  // Map the compare result into per-country rows for the currently-selected
  // indicator, preserving the user's selection order.
  const indicatorRows: IndicatorRow[] = useMemo(() => {
    if (!compareData) return [];
    const byId = new Map(compareData.countries.map((c) => [c.countryId, c]));
    return selectedCountries.map((country) => {
      const result = byId.get(country.id);
      const ind = result?.indicators.find((i) => i.indicatorId === selectedIndicatorId);
      return {
        country: country.name,
        countryShort: country.name.length > 12 ? country.name.slice(0, 11) + '…' : country.name,
        value: ind?.value ?? null,
        unit: ind?.unit ?? selectedIndicator?.unit ?? '',
        rank: ind?.rank ?? null,
        percentile: ind?.percentile ?? null,
        regionalAverage: ind?.regionalAverage ?? null,
        continentalAverage: ind?.continentalAverage ?? null,
      };
    });
  }, [compareData, selectedCountries, selectedIndicatorId, selectedIndicator]);

  // ── Theme profiles (radar) ──────────────────────────────────────────────────
  // One query per selected country; the backend gives 7 theme averageScores.
  const themeQueries = useQueries({
    queries: selectedCountryIds.map((id) => ({
      queryKey: ['compare', 'themes', id, selectedYear],
      queryFn: () => api.compare.themes(id, selectedYear),
      enabled: chartType === 'radar' && selectedCountryIds.length > 0,
      staleTime: 1000 * 60 * 5,
    })),
  });
  const themeLoading = themeQueries.some((q) => q.isLoading && q.fetchStatus !== 'idle');
  const themeError = themeQueries.some((q) => q.isError);

  // Build radar rows: one axis per theme, value = averageScore (0-100) per country.
  const radarData: RadarRow[] = useMemo(() => {
    const results = themeQueries
      .map((q, i) => ({ countryName: selectedCountryNames[i], data: q.data as CompareThemesResult | undefined }))
      .filter((r) => r.data);
    if (results.length === 0) return [];

    // Collect the union of themes (keyed by slug) preserving first-seen order.
    const themeOrder: { slug: string; name: string }[] = [];
    const seen = new Set<string>();
    results.forEach((r) => {
      r.data!.themes.forEach((th) => {
        if (!seen.has(th.slug)) {
          seen.add(th.slug);
          themeOrder.push({ slug: th.slug, name: th.themeName });
        }
      });
    });

    return themeOrder.map(({ slug, name }) => {
      const values: Record<string, number | null> = {};
      results.forEach((r) => {
        const th = r.data!.themes.find((t) => t.slug === slug);
        values[r.countryName] = th?.averageScore ?? null;
      });
      return { dimension: name, values };
    });
  }, [themeQueries, selectedCountryNames]);

  // Combined loading/error state for the active chart.
  const chartIsLoading = chartType === 'radar' ? themeLoading : compareLoading;
  const chartIsError = chartType === 'radar' ? themeError : compareError;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCountryToggle = (countryId: string) => {
    if (selectedCountryIds.includes(countryId)) {
      setSelectedCountryIds(selectedCountryIds.filter((c) => c !== countryId));
    } else if (selectedCountryIds.length < MAX_COUNTRIES) {
      setSelectedCountryIds([...selectedCountryIds, countryId]);
    }
  };

  const handleDownload = () => {
    if (!selectedCountryIds.length || !selectedIndicatorId) {
      toast({ title: 'Nothing to export', description: 'Select countries and an indicator first.' });
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = renderComparisonPng({
        selectedCountries: selectedCountryNames,
        selectedIndicator: selectedIndicator?.name ?? 'Comparison',
        selectedTheme: selectedTheme?.name ?? '',
        selectedYear,
        chartType,
        indicatorRows,
        radarData,
      });
      const link = document.createElement('a');
      const safeIndicator = (selectedIndicator?.slug ?? selectedIndicator?.name ?? 'comparison').replace(/[^\w-]+/g, '-').toLowerCase();
      link.download = `ayo-compare-${safeIndicator}-${selectedYear}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: 'Image downloaded', description: link.download });
    } catch (e) {
      toast({ title: 'Download failed', description: e instanceof Error ? e.message : 'Could not generate image.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const FilterContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-gray-300">Selected Countries ({selectedCountryIds.length}/{MAX_COUNTRIES})</Label>
        <div className="grid grid-cols-1 gap-1.5 max-h-[150px] md:max-h-[180px] overflow-y-auto pr-1">
          {selectedCountries.length === 0 && (
            <p className="text-xs text-gray-500 italic px-1">No countries selected</p>
          )}
          {selectedCountries.map((country) => (
            <div key={country.id} className="flex items-center justify-between bg-white/[0.04] border border-gray-800 px-2 py-1.5 rounded-md">
              <span className="text-xs truncate mr-2 flex items-center gap-1.5">
                <CountryFlag country={country.name} size="xs" />
                {country.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCountryToggle(country.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {selectedCountryIds.length < MAX_COUNTRIES && (
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-300">Add Country</Label>
          <Select onValueChange={handleCountryToggle} value="">
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder={allCountries.length ? 'Pick a country' : 'Loading countries…'} />
            </SelectTrigger>
            <SelectContent>
              {allCountries
                .filter((country) => !selectedCountryIds.includes(country.id))
                .map((country) => (
                  <SelectItem key={country.id} value={country.id} className="text-xs">
                    {country.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="theme" className="text-xs text-gray-300">Theme</Label>
          <Select
            value={effectiveThemeId}
            onValueChange={(value) => {
              setSelectedThemeId(value);
              setSelectedIndicatorId('');
            }}
          >
            <SelectTrigger id="theme" className="text-xs h-9">
              <SelectValue placeholder={allThemes.length ? 'Theme' : 'Loading…'} />
            </SelectTrigger>
            <SelectContent>
              {allThemes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id} className="text-xs">{theme.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year" className="text-xs text-gray-300 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Year
          </Label>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger id="year" className="text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="indicator" className="text-xs text-gray-300">Indicator</Label>
        <Select value={selectedIndicatorId} onValueChange={setSelectedIndicatorId} disabled={!availableIndicators.length}>
          <SelectTrigger id="indicator" className="text-xs h-9">
            <SelectValue placeholder={availableIndicators.length ? 'Select an indicator' : 'Loading indicators…'} />
          </SelectTrigger>
          <SelectContent>
            {availableIndicators.map((indicator) => (
              <SelectItem key={indicator.id} value={indicator.id} className="text-xs">{indicator.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-gray-500 leading-snug">
          Bar &amp; table show this indicator. The Radar view compares all themes (uses averageScore per theme).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-300">Chart Type</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { type: 'bar' as const, label: 'Bar', icon: BarChart3 },
            { type: 'horizontal-bar' as const, label: 'Ranking', icon: ArrowDownUp },
            { type: 'lollipop' as const, label: 'Lollipop', icon: TrendingUp },
            { type: 'radar' as const, label: 'Radar', icon: Hexagon },
          ]).map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all border ${
                chartType === type
                  ? 'bg-[#D4A017]/15 text-[#D4A017] border-[#D4A017]/40 shadow-sm'
                  : 'border-gray-800 text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container px-4 md:px-6 pt-2 md:pt-3 pb-6 md:pb-8">
      {/* Mobile Filter Button */}
      <div className="lg:hidden mb-3">
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {selectedCountryIds.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {selectedCountryIds.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[340px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Compare Countries</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-3">
        {/* Desktop Filters */}
        <aside className="hidden lg:block lg:col-span-1">
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 sticky top-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Comparison Setup</h3>
            <FilterContent />
          </div>
        </aside>

        {/* Comparison Card (live, on-page) */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 md:p-6">
            {/* Export-friendly header — branded */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4 pb-4 border-b border-gray-800/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-md bg-[#D4A017] flex items-center justify-center text-black text-[11px] font-bold tracking-wider">AYO</div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-mono">Country Comparison · {selectedTheme?.name ?? '—'}</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">
                  {chartType === 'radar' ? 'Cross-theme profile' : (selectedIndicator?.name || 'Select an indicator')}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedCountries.length > 0
                    ? `${selectedCountries.length} ${selectedCountries.length === 1 ? 'country' : 'countries'}`
                    : 'No countries'}
                  <span className="mx-1.5 text-gray-700">·</span>
                  Year {selectedYear}
                </p>
                {selectedCountries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {selectedCountries.map((c, i) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                        style={{
                          background: `${CHART_COLORS[i % CHART_COLORS.length]}15`,
                          borderColor: `${CHART_COLORS[i % CHART_COLORS.length]}40`,
                          color: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={downloading || !selectedCountryIds.length || !selectedIndicatorId || chartIsLoading}
                className="gap-1.5 h-8 text-xs"
              >
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {downloading ? 'Generating…' : 'Download PNG'}
              </Button>
            </div>

            <ComparisonChart
              selectedCountries={selectedCountryNames}
              selectedIndicator={selectedIndicatorId}
              chartType={chartType}
              indicatorRows={indicatorRows}
              radarData={radarData}
              isLoading={chartIsLoading}
              isError={chartIsError}
            />

            {/* Data table — real indicator values, ranks, percentiles, averages */}
            {selectedCountryIds.length > 0 && selectedIndicatorId && (
              <div className="mt-5 overflow-x-auto rounded-xl border border-gray-800/60">
                <table className="min-w-full">
                  <thead className="bg-white/[0.02]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Country</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">{selectedIndicator?.name ?? 'Value'}</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="hidden sm:table-cell px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Pctl</th>
                      <th className="hidden md:table-cell px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Reg. avg</th>
                      <th className="hidden md:table-cell px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Cont. avg</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {compareLoading && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading data…
                        </td>
                      </tr>
                    )}
                    {!compareLoading && compareError && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-xs text-rose-400">
                          Could not load data.
                        </td>
                      </tr>
                    )}
                    {!compareLoading && !compareError && indicatorRows.map((row, i) => (
                      <tr key={row.country} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-xs sm:text-sm font-medium">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <CountryFlag country={row.country} size="sm" />
                            {row.country}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right text-xs sm:text-sm tabular-nums font-semibold ${row.value === null ? 'text-gray-600' : 'text-white'}`}>
                          {fmtValue(row.value, row.unit)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-400 tabular-nums">{row.rank !== null ? `#${row.rank}` : '—'}</td>
                        <td className="hidden sm:table-cell px-3 py-2 text-right text-xs text-gray-400 tabular-nums">{row.percentile !== null ? `${Math.round(row.percentile)}` : '—'}</td>
                        <td className="hidden md:table-cell px-3 py-2 text-right text-xs text-gray-400 tabular-nums">{fmtValue(row.regionalAverage, row.unit)}</td>
                        <td className="hidden md:table-cell px-3 py-2 text-right text-xs text-gray-400 tabular-nums">{fmtValue(row.continentalAverage, row.unit)}</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500 tabular-nums">{selectedYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Branded footer line — visible in the exported PNG */}
            <div className="mt-4 pt-3 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-500">
              <span>African Youth Observatory · africanyouthobservatory.org</span>
              <span className="font-mono">Source: African Youth Observatory database</span>
            </div>
          </div>

          {/* Analysis card (outside export region) */}
          <div className="mt-4 p-4 bg-white/[0.03] border border-gray-800 rounded-xl">
            <h4 className="font-medium mb-1 text-sm text-gray-200">Analysis</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {selectedCountryIds.length > 0 && selectedIndicatorId
                ? chartType === 'radar'
                  ? `This radar compares ${selectedCountries.length} ${selectedCountries.length === 1 ? 'country' : 'countries'} across all themes for ${selectedYear}, using each theme's average score (0–100). Switch to the bar views to inspect a single indicator.`
                  : `This comparison shows ${(selectedIndicator?.name ?? 'the selected indicator').toLowerCase()} across ${selectedCountries.length} selected ${selectedCountries.length === 1 ? 'country' : 'countries'} for ${selectedYear}. Switch chart types from the panel to view the same data as a vertical/horizontal bar comparison, a ranked lollipop, or a multi-dimensional radar.`
                : 'Select countries and an indicator to see the comparative analysis.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountryComparison;
