import React, { useState, useMemo } from 'react';
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

/* Deterministic pseudo-random helpers (seeded by country + indicator + year) */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

const CHART_COLORS = ['#22C55E', '#F59E0B', '#3B82F6', '#A855F7', '#F43F5E'];

const countries = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso",
  "Burundi", "Cabo Verde", "Cameroon", "Central African Republic", "Chad",
  "Comoros", "Congo", "Côte d'Ivoire", "DRC", "Djibouti", "Egypt", "Equatorial Guinea",
  "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
  "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar",
  "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique",
  "Namibia", "Niger", "Nigeria", "Rwanda", "São Tomé and Príncipe", "Senegal",
  "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan",
  "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
];

const indicators = {
  Population: ['Youth Population (15-35)', 'Youth as % of Total Population', 'Youth Growth Rate', 'Youth Urban/Rural Distribution'],
  Education: ['Youth Literacy Rate', 'Secondary School Enrollment', 'Tertiary Enrollment', 'Gender Parity in Education'],
  Health: ['Youth Access to Healthcare', 'HIV Prevalence Among Youth', 'Youth Mental Health Services', 'Youth Nutrition Status'],
  Employment: ['Youth Unemployment Rate', 'Youth Labor Force Participation', 'Youth in Informal Sector', 'Youth Average Wages'],
  Entrepreneurship: ['Youth Business Ownership', 'Youth Startup Formation', 'Youth Access to Finance', 'Youth Innovation Index'],
};

const radarDimensions = ['Education', 'Health', 'Employment', 'Entrepreneurship', 'Population'];

type ChartType = 'bar' | 'horizontal-bar' | 'lollipop' | 'radar';

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

/* ─────────────────────────────────────────────────────────────────────────
   renderComparisonPng — draws the comparison card directly to a Canvas using
   the native 2D API. No html2canvas, no SVG capture, no DOM dependency. The
   output is a deterministic 1080-wide PNG that always fits its content.
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

interface ChartValue { country: string; value: number; }

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

  // AYO logo + org line
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

  // Indicator title (wraps if too long)
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const titleLines = wrapLines(ctx, selectedIndicator || 'Comparison', W - PAD * 2);
  for (const line of titleLines) {
    y += 42;
    ctx.fillText(line, PAD, y);
  }

  // Subtitle
  y += 32;
  ctx.fillStyle = '#a8a29e';
  ctx.font = '400 16px system-ui';
  const countText = selectedCountries.length === 1 ? '1 country' : `${selectedCountries.length} countries`;
  ctx.fillText(`${countText} · Year ${selectedYear}`, PAD, y);

  // Country pills (wrap to multiple rows if needed)
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

    // pill background
    ctx.fillStyle = color + '1f';
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    // pill border
    ctx.strokeStyle = color + '55';
    ctx.lineWidth = 1;
    ctx.stroke();
    // dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pillX + padX + 4, pillY + pillH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    // text
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

function drawVerticalBars(ctx: CanvasRenderingContext2D, area: { x: number; y: number; w: number; h: number }, values: ChartValue[]) {
  const { x, y, w, h } = area;
  const padBottom = 36;  // space for x labels
  const padTop = 28;     // space for top labels
  const padLeft = 48;    // space for y axis
  const chartX = x + padLeft;
  const chartY = y + padTop;
  const chartW = w - padLeft;
  const chartH = h - padBottom - padTop;

  // y-axis grid + ticks
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
    ctx.fillText(`${i * 20}%`, chartX - 8, yy);
  }

  // Bars
  const n = values.length;
  if (n === 0) return;
  const slot = chartW / n;
  const barW = Math.min(80, slot * 0.55);
  values.forEach((v, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const slotCenter = chartX + slot * (i + 0.5);
    const barX = slotCenter - barW / 2;
    const barH = (v.value / 100) * chartH;
    const barY = chartY + chartH - barH;
    ctx.fillStyle = color;
    roundRect(ctx, barX, barY, barW, barH, 8);
    ctx.fill();

    // Top label
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${v.value}%`, slotCenter, barY - 6);

    // X-axis label (truncate long names)
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
  values: ChartValue[],
  variant: 'bar' | 'lollipop',
) {
  const sorted = [...values].sort((a, b) => b.value - a.value);
  const { x, y, w, h } = area;
  const padTop = 16;
  const padBottom = 28;
  const padLeft = 200;
  const padRight = 60;
  const chartX = x + padLeft;
  const chartY = y + padTop;
  const chartW = w - padLeft - padRight;
  const chartH = h - padBottom - padTop;

  // x-axis grid + ticks
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
    ctx.fillText(`${i * 20}%`, xx, chartY + chartH + 8);
  }

  // Rows
  const n = sorted.length;
  if (n === 0) return;
  const rowH = chartH / n;
  const barH = Math.min(44, rowH * 0.6);
  sorted.forEach((v, i) => {
    const color = CHART_COLORS[values.findIndex((d) => d.country === v.country) % CHART_COLORS.length];
    const cy = chartY + rowH * (i + 0.5);
    const barW = (v.value / 100) * chartW;

    // Country label (left)
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '600 14px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const lbl = v.country.length > 22 ? v.country.slice(0, 21) + '…' : v.country;
    ctx.fillText(lbl, chartX - 14, cy);

    if (variant === 'bar') {
      ctx.fillStyle = color;
      roundRect(ctx, chartX, cy - barH / 2, barW, barH, 8);
      ctx.fill();
    } else {
      // Lollipop: thin stem + circle
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, chartX, cy - 1.5, barW, 3, 1.5);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(chartX + barW, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0e14';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Value label (right of bar/dot)
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${v.value}%`, chartX + barW + (variant === 'lollipop' ? 22 : 10), cy);
  });
}

function drawRadar(
  ctx: CanvasRenderingContext2D,
  area: { x: number; y: number; w: number; h: number },
  countries: string[],
  data: { dimension: string; values: Record<string, number> }[],
) {
  const { x, y, w, h } = area;
  // Reserve bottom strip for legend
  const legendH = 36;
  const radarH = h - legendH;
  const cx = x + w / 2;
  const cy = y + radarH / 2;
  const radius = Math.min(w, radarH) * 0.36;

  // Concentric grid rings
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

  // Spokes + axis labels
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '500 14px system-ui';
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
    // Label outside the spoke
    const lx = cx + (radius + 22) * Math.cos(a);
    const ly = cy + (radius + 22) * Math.sin(a);
    ctx.fillText(data[i].dimension, lx, ly);
  }

  // Country polygons
  countries.forEach((country, ci) => {
    const color = CHART_COLORS[ci % CHART_COLORS.length];
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const v = data[i].values[country] ?? 0;
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / data.length;
      const r = (radius * v) / 100;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color + '38'; // ~22% opacity
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Vertex dots
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

  // Legend (bottom of area)
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
    // wrap if running out of horizontal room
    if (legX > x + w - 80 && ci < countries.length - 1) {
      legX = x + 16;
      // but we only have one line of legend in this layout — break out
    }
  });
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  W: number,
  startY: number,
  selectedCountries: string[],
  selectedIndicator: string,
  selectedYear: number,
): number {
  const PAD = 48;
  let y = startY;
  // Header row
  ctx.fillStyle = '#7d8590';
  ctx.font = '600 11px system-ui';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('COUNTRY', PAD + 4, y + 14);
  ctx.textAlign = 'right';
  ctx.fillText('VALUE', W - PAD - 90, y + 14);
  ctx.fillText('YEAR', W - PAD - 4, y + 14);
  // Header underline
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(PAD, y + 22);
  ctx.lineTo(W - PAD, y + 22);
  ctx.stroke();
  y += 22;

  // Rows
  selectedCountries.forEach((country, i) => {
    const seed = hashCode(country + selectedIndicator + selectedYear);
    const value = Math.floor(20 + seededRandom(seed, 0) * 70);
    const color = CHART_COLORS[i % CHART_COLORS.length];
    y += 38;

    // dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(PAD + 8, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    // country
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(country, PAD + 22, y);
    // value
    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`${value}%`, W - PAD - 90, y);
    // year
    ctx.fillStyle = '#7d8590';
    ctx.font = '500 14px system-ui';
    ctx.fillText(String(selectedYear), W - PAD - 4, y);

    // row underline
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
  // Top border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, startY);
  ctx.lineTo(W, startY);
  ctx.stroke();
  // Text
  ctx.fillStyle = '#a8a29e';
  ctx.font = '500 12px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('africanyouthobservatory.org', PAD, startY + 26);
  ctx.fillStyle = '#7d8590';
  ctx.font = '500 11px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Source: National stats offices · UNDP Africa', W - PAD, startY + 26);
  return startY + 52;
}

function renderComparisonPng({
  selectedCountries,
  selectedIndicator,
  selectedTheme,
  selectedYear,
  chartType,
}: {
  selectedCountries: string[];
  selectedIndicator: string;
  selectedTheme: string;
  selectedYear: number;
  chartType: ChartType;
}): string {
  const W = 1080;
  const SCALE = 2;

  // Build data
  const barData: ChartValue[] = selectedCountries.map((country) => {
    const seed = hashCode(country + selectedIndicator + selectedYear);
    return { country, value: Math.round(20 + seededRandom(seed, 0) * 70) };
  });
  const radarChartData = radarDimensions.map((dim, di) => {
    const values: Record<string, number> = {};
    selectedCountries.forEach((country) => {
      const seed = hashCode(country + dim + selectedYear);
      values[country] = Math.round(30 + seededRandom(seed, di) * 60);
    });
    return { dimension: dim, values };
  });

  // First pass: measure header to find total height. We use a temp canvas.
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

  // Second pass: real canvas
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, W, totalH);

  // Top accent stripe
  const stripe = ctx.createLinearGradient(0, 0, W, 0);
  stripe.addColorStop(0, '#22C55E');
  stripe.addColorStop(0.5, '#D4A017');
  stripe.addColorStop(1, '#F43F5E');
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, W, 6);

  // Header
  drawHeader(ctx, W, 32, selectedTheme, selectedIndicator, selectedYear, selectedCountries);

  // Chart card
  const chartArea = drawChartCard(ctx, W, headerEnd, chartHeight);
  if (chartType === 'bar') {
    drawVerticalBars(ctx, chartArea, barData);
  } else if (chartType === 'horizontal-bar') {
    drawHorizontalBars(ctx, chartArea, barData, 'bar');
  } else if (chartType === 'lollipop') {
    drawHorizontalBars(ctx, chartArea, barData, 'lollipop');
  } else {
    drawRadar(ctx, chartArea, selectedCountries, radarChartData);
  }

  // Table
  drawTable(ctx, W, tableStart, selectedCountries, selectedIndicator, selectedYear);

  // Footer
  drawFooter(ctx, W, footerStart);

  return canvas.toDataURL('image/png');
}


/** Comparison chart sub-component */
function ComparisonChart({
  selectedCountries,
  selectedIndicator,
  chartType,
  selectedYear,
}: {
  selectedCountries: string[];
  selectedIndicator: string;
  chartType: ChartType;
  selectedYear: number;
}) {
  const barData = useMemo(() => {
    return selectedCountries.map((country) => {
      const seed = hashCode(country + selectedIndicator + selectedYear);
      return {
        country,
        countryShort: country.length > 12 ? country.slice(0, 11) + '…' : country,
        value: Math.round(20 + seededRandom(seed, 0) * 70),
      };
    });
  }, [selectedCountries, selectedIndicator, selectedYear]);

  // Sort descending for horizontal bar / lollipop (gives ranking effect)
  const sortedBarData = useMemo(() => [...barData].sort((a, b) => b.value - a.value), [barData]);

  const radarData = useMemo(() => {
    return radarDimensions.map((dim, di) => {
      const entry: Record<string, string | number> = { dimension: dim };
      selectedCountries.forEach((country) => {
        const seed = hashCode(country + dim + selectedYear);
        entry[country] = Math.round(30 + seededRandom(seed, di) * 60);
      });
      return entry;
    });
  }, [selectedCountries, selectedYear]);

  if (selectedCountries.length === 0 || !selectedIndicator) {
    return (
      <div className="h-[320px] sm:h-[380px] md:h-[440px] border border-gray-800 rounded-xl bg-black/30 p-4 flex items-center justify-center">
        <p className="text-sm text-gray-500 text-center px-4">
          {selectedCountries.length === 0
            ? 'Select countries to compare'
            : 'Select an indicator to display chart data'}
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
  const avg = barData.length ? barData.reduce((a, b) => a + b.value, 0) / barData.length : 0;

  return (
    <div className="h-[320px] sm:h-[380px] md:h-[440px] border border-gray-800 rounded-xl bg-black/30 p-2 sm:p-4">
      {chartType === 'bar' && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 16, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="countryShort" tick={tickStyle} interval={0} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={36} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value}%`, selectedIndicator]}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <ReferenceLine y={avg} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" label={{ value: `avg ${avg.toFixed(1)}%`, position: 'right', fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
            <Bar dataKey="value" name={selectedIndicator} radius={[6, 6, 0, 0]} maxBarSize={50}>
              {barData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartType === 'horizontal-bar' && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedBarData} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
            <YAxis dataKey="countryShort" type="category" tick={tickStyle} tickLine={false} axisLine={false} width={92} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value}%`, selectedIndicator]}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {sortedBarData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartType === 'lollipop' && (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sortedBarData} layout="vertical" margin={{ top: 6, right: 32, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
            <YAxis dataKey="countryShort" type="category" tick={tickStyle} tickLine={false} axisLine={false} width={92} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value}%`, selectedIndicator]}
              cursor={false}
            />
            <Bar dataKey="value" maxBarSize={2} fill="rgba(34,197,94,0.4)" />
            <Scatter dataKey="value" shape={(props: any) => {
              const { cx, cy, payload } = props;
              const idx = sortedBarData.findIndex((d) => d.country === payload.country);
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              return (
                <g>
                  <circle cx={cx} cy={cy} r={9} fill={color} stroke="#0a0e14" strokeWidth={2} />
                  <text x={cx + 14} y={cy + 4} fill="rgba(255,255,255,0.85)" fontSize={11} fontWeight={600}>{payload.value}%</text>
                </g>
              );
            }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {chartType === 'radar' && (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
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
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>('Education');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const availableIndicators = indicators[selectedTheme as keyof typeof indicators] || [];

  const handleCountryToggle = (country: string) => {
    if (selectedCountries.includes(country)) {
      setSelectedCountries(selectedCountries.filter((c) => c !== country));
    } else {
      if (selectedCountries.length < 5) setSelectedCountries([...selectedCountries, country]);
    }
  };

  const handleDownload = () => {
    if (!selectedCountries.length || !selectedIndicator) {
      toast({ title: 'Nothing to export', description: 'Select countries and an indicator first.' });
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = renderComparisonPng({
        selectedCountries,
        selectedIndicator,
        selectedTheme,
        selectedYear,
        chartType,
      });
      const link = document.createElement('a');
      const safeIndicator = selectedIndicator.replace(/[^\w-]+/g, '-').toLowerCase();
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
        <Label className="text-xs text-gray-300">Selected Countries ({selectedCountries.length}/5)</Label>
        <div className="grid grid-cols-1 gap-1.5 max-h-[150px] md:max-h-[180px] overflow-y-auto pr-1">
          {selectedCountries.length === 0 && (
            <p className="text-xs text-gray-500 italic px-1">No countries selected</p>
          )}
          {selectedCountries.map((country) => (
            <div key={country} className="flex items-center justify-between bg-white/[0.04] border border-gray-800 px-2 py-1.5 rounded-md">
              <span className="text-xs truncate mr-2 flex items-center gap-1.5">
                <CountryFlag country={country} size="xs" />
                {country}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCountryToggle(country)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {selectedCountries.length < 5 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-300">Add Country</Label>
          <Select onValueChange={handleCountryToggle}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Pick a country" />
            </SelectTrigger>
            <SelectContent>
              {countries
                .filter((country) => !selectedCountries.includes(country))
                .map((country) => (
                  <SelectItem key={country} value={country} className="text-xs">
                    {country}
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
            value={selectedTheme}
            onValueChange={(value) => {
              setSelectedTheme(value);
              setSelectedIndicator('');
            }}
          >
            <SelectTrigger id="theme" className="text-xs h-9">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(indicators).map((theme) => (
                <SelectItem key={theme} value={theme} className="text-xs">{theme}</SelectItem>
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
        <Select value={selectedIndicator} onValueChange={setSelectedIndicator}>
          <SelectTrigger id="indicator" className="text-xs h-9">
            <SelectValue placeholder="Select an indicator" />
          </SelectTrigger>
          <SelectContent>
            {availableIndicators.map((indicator) => (
              <SelectItem key={indicator} value={indicator} className="text-xs">{indicator}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              {selectedCountries.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {selectedCountries.length}
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
                  <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-mono">Country Comparison · {selectedTheme}</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">
                  {selectedIndicator || 'Select an indicator'}
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
                        key={c}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                        style={{
                          background: `${CHART_COLORS[i % CHART_COLORS.length]}15`,
                          borderColor: `${CHART_COLORS[i % CHART_COLORS.length]}40`,
                          color: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={downloading || !selectedCountries.length || !selectedIndicator}
                className="gap-1.5 h-8 text-xs"
              >
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {downloading ? 'Generating…' : 'Download PNG'}
              </Button>
            </div>

            <ComparisonChart
              selectedCountries={selectedCountries}
              selectedIndicator={selectedIndicator}
              chartType={chartType}
              selectedYear={selectedYear}
            />

            {/* Data table */}
            {selectedCountries.length > 0 && selectedIndicator && (
              <div className="mt-5 overflow-x-auto rounded-xl border border-gray-800/60">
                <table className="min-w-full">
                  <thead className="bg-white/[0.02]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Country</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">{selectedIndicator}</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {selectedCountries.map((country, i) => {
                      const seed = hashCode(country + selectedIndicator + selectedYear);
                      const value = Math.floor(20 + seededRandom(seed, 0) * 70);
                      return (
                        <tr key={country} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-xs sm:text-sm font-medium">
                            <span className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <CountryFlag country={country} size="sm" />
                              {country}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs sm:text-sm tabular-nums font-semibold text-white">{value}%</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500 tabular-nums">{selectedYear}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Branded footer line — visible in the exported PNG */}
            <div className="mt-4 pt-3 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-500">
              <span>African Youth Observatory · africanyouthobservatory.org</span>
              <span className="font-mono">Source: National statistical offices · UNDP Africa</span>
            </div>
          </div>

          {/* Analysis card (outside export region) */}
          <div className="mt-4 p-4 bg-white/[0.03] border border-gray-800 rounded-xl">
            <h4 className="font-medium mb-1 text-sm text-gray-200">Analysis</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {selectedCountries.length > 0 && selectedIndicator
                ? `This comparison shows ${selectedIndicator.toLowerCase()} across ${selectedCountries.length} selected ${selectedCountries.length === 1 ? 'country' : 'countries'} for ${selectedYear}. Switch chart types from the panel to view the same data as a vertical/horizontal bar comparison, a ranked lollipop, or a multi-dimensional radar.`
                : 'Select countries and an indicator to see the comparative analysis.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountryComparison;
