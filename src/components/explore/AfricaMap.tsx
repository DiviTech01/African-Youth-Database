import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { api } from '@/lib/api-client';

interface AfricaMapProps {
  onCountrySelect: (country: string) => void;
  selectedCountry?: string;
}

// ISO 3166-1 numeric → display name. All 54 AU member states.
const AFRICA_ISO: Record<string, { name: string; region: Region; capital: [number, number] }> = {
  '012': { name: 'Algeria', region: 'North', capital: [3.05, 36.75] },
  '024': { name: 'Angola', region: 'Central', capital: [13.23, -8.84] },
  '204': { name: 'Benin', region: 'West', capital: [2.42, 6.50] },
  '072': { name: 'Botswana', region: 'Southern', capital: [25.91, -24.66] },
  '854': { name: 'Burkina Faso', region: 'West', capital: [-1.52, 12.37] },
  '108': { name: 'Burundi', region: 'East', capital: [29.36, -3.38] },
  '132': { name: 'Cape Verde', region: 'West', capital: [-23.51, 14.93] },
  '120': { name: 'Cameroon', region: 'Central', capital: [11.50, 3.85] },
  '140': { name: 'Central African Republic', region: 'Central', capital: [18.55, 4.39] },
  '148': { name: 'Chad', region: 'Central', capital: [15.04, 12.13] },
  '174': { name: 'Comoros', region: 'East', capital: [43.25, -11.70] },
  '178': { name: 'Republic of the Congo', region: 'Central', capital: [15.27, -4.27] },
  '384': { name: "Côte d'Ivoire", region: 'West', capital: [-4.03, 5.32] },
  '180': { name: 'Democratic Republic of the Congo', region: 'Central', capital: [15.30, -4.32] },
  '262': { name: 'Djibouti', region: 'East', capital: [43.15, 11.59] },
  '818': { name: 'Egypt', region: 'North', capital: [31.24, 30.04] },
  '226': { name: 'Equatorial Guinea', region: 'Central', capital: [8.78, 3.75] },
  '232': { name: 'Eritrea', region: 'East', capital: [38.93, 15.32] },
  '748': { name: 'Eswatini', region: 'Southern', capital: [31.13, -26.32] },
  '231': { name: 'Ethiopia', region: 'East', capital: [38.74, 9.03] },
  '266': { name: 'Gabon', region: 'Central', capital: [9.45, 0.42] },
  '270': { name: 'Gambia', region: 'West', capital: [-16.57, 13.45] },
  '288': { name: 'Ghana', region: 'West', capital: [-0.20, 5.60] },
  '324': { name: 'Guinea', region: 'West', capital: [-13.71, 9.64] },
  '624': { name: 'Guinea-Bissau', region: 'West', capital: [-15.59, 11.86] },
  '404': { name: 'Kenya', region: 'East', capital: [36.82, -1.29] },
  '426': { name: 'Lesotho', region: 'Southern', capital: [27.49, -29.31] },
  '430': { name: 'Liberia', region: 'West', capital: [-10.80, 6.31] },
  '434': { name: 'Libya', region: 'North', capital: [13.19, 32.89] },
  '450': { name: 'Madagascar', region: 'East', capital: [47.52, -18.88] },
  '454': { name: 'Malawi', region: 'East', capital: [33.79, -13.96] },
  '466': { name: 'Mali', region: 'West', capital: [-8.00, 12.65] },
  '478': { name: 'Mauritania', region: 'West', capital: [-15.98, 18.08] },
  '480': { name: 'Mauritius', region: 'East', capital: [57.50, -20.16] },
  '504': { name: 'Morocco', region: 'North', capital: [-6.84, 34.02] },
  '508': { name: 'Mozambique', region: 'East', capital: [32.58, -25.97] },
  '516': { name: 'Namibia', region: 'Southern', capital: [17.08, -22.55] },
  '562': { name: 'Niger', region: 'West', capital: [2.11, 13.51] },
  '566': { name: 'Nigeria', region: 'West', capital: [7.49, 9.05] },
  '646': { name: 'Rwanda', region: 'East', capital: [30.06, -1.95] },
  '678': { name: 'São Tomé and Príncipe', region: 'Central', capital: [6.73, 0.34] },
  '686': { name: 'Senegal', region: 'West', capital: [-17.45, 14.69] },
  '690': { name: 'Seychelles', region: 'East', capital: [55.45, -4.62] },
  '694': { name: 'Sierra Leone', region: 'West', capital: [-13.23, 8.48] },
  '706': { name: 'Somalia', region: 'East', capital: [45.34, 2.04] },
  '710': { name: 'South Africa', region: 'Southern', capital: [28.19, -25.75] },
  '728': { name: 'South Sudan', region: 'East', capital: [31.58, 4.85] },
  '729': { name: 'Sudan', region: 'North', capital: [32.53, 15.50] },
  '834': { name: 'Tanzania', region: 'East', capital: [35.74, -6.16] },
  '768': { name: 'Togo', region: 'West', capital: [1.21, 6.13] },
  '788': { name: 'Tunisia', region: 'North', capital: [10.17, 36.81] },
  '800': { name: 'Uganda', region: 'East', capital: [32.58, 0.35] },
  '894': { name: 'Zambia', region: 'East', capital: [28.29, -15.42] },
  '716': { name: 'Zimbabwe', region: 'East', capital: [31.05, -17.83] },
};

type Region = 'North' | 'West' | 'East' | 'Central' | 'Southern';

const REGION_TINT: Record<Region, string> = {
  North:    'rgba(96, 165, 250, 0.10)', // blue
  West:     'rgba(34, 197, 94, 0.10)',  // green
  East:     'rgba(168, 85, 247, 0.10)', // purple
  Central:  'rgba(245, 158, 11, 0.10)', // amber
  Southern: 'rgba(244, 63, 94, 0.10)',  // rose
};

const REGION_HEX: Record<Region, string> = {
  North:    '#60A5FA',
  West:     '#22C55E',
  East:     '#A855F7',
  Central:  '#F59E0B',
  Southern: '#F43F5E',
};

const padIso = (raw: string | number): string => String(raw).padStart(3, '0');
const GEO_URL = '/maps/world-50m.json';

const AfricaMap: React.FC<AfricaMapProps> = ({ onCountrySelect, selectedCountry }) => {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<Region | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Per-geometry label centroid cache (lon/lat). Computed once per country the
  // first time it renders, then reused — the summation over every polygon point
  // is pure geometry and never changes, so it should not run on each re-render.
  const centroidCache = React.useRef<Record<string, [number, number] | null>>({});

  // Real continent snapshot numbers from /platform/stats (same source as
  // Hero/QuickStats). Until the API resolves — or if it errors — every value
  // renders "—"; we never show a fabricated count.
  const { data: platformStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.platform.stats().catch(() => null),
    staleTime: 60_000,
  });
  const earliest = platformStats?.dataYearRange?.earliest;
  const latest = platformStats?.dataYearRange?.latest;
  const yearRange = earliest && latest ? `${earliest}–${latest}` : '—';
  const fmtNum = (v: number | null | undefined): string =>
    v == null ? '—' : v.toLocaleString();

  // Africa-only label set — only larger countries get labels at this scale
  const labelSet = useMemo(
    () => new Set([
      'Nigeria', 'Egypt', 'Ethiopia', 'Kenya', 'South Africa',
      'Democratic Republic of the Congo', 'Algeria', 'Tanzania', 'Morocco',
      'Angola', 'Mali', 'Niger', 'Chad', 'Sudan', 'Libya', 'Somalia',
      'Madagascar', 'Mozambique', 'Zambia', 'Zimbabwe', 'Ghana', 'Cameroon',
      'Namibia', 'Botswana', 'Uganda', 'Tunisia', 'Senegal', 'South Sudan',
      'Mauritania',
    ]),
    [],
  );

  // Hover identity (which country) is set once on enter/leave — NOT on every
  // mousemove. Setting hovered state per-frame forced all 54 geographies +
  // markers + label math to re-render on every pixel of cursor movement, which
  // was the dominant source of scroll/hover jank.
  const onCountryEnter = React.useCallback((e: React.MouseEvent, name: string, region: Region) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top - 14 });
    }
    setHoveredCountry(name);
    setHoveredRegion(region);
  }, []);

  const onLeave = React.useCallback(() => {
    setHoveredCountry(null);
    setHoveredRegion(null);
  }, []);

  // Tooltip follows the cursor via a container-level handler. tooltipPos is not
  // read by the <Geographies> render path, so updating it only re-renders the
  // lightweight tooltip element, never the map.
  const handleContainerMove = React.useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top - 14 });
  }, []);

  const selectedRegion: Region | null = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'All Countries') return null;
    const entry = Object.values(AFRICA_ISO).find((c) => c.name === selectedCountry);
    return entry?.region ?? null;
  }, [selectedCountry]);

  return (
    <div
      ref={containerRef}
      onMouseMove={hoveredCountry ? handleContainerMove : undefined}
      className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden bg-[#04070d]"
    >
      {/* Layered backdrop: subtle radial glow + grid */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#04070d] via-[#0a1019] to-[#04070d]" />
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 60%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 45%, rgba(34,197,94,0.10) 0%, rgba(0,0,0,0) 60%)',
        }}
      />

      {/* The map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 480, center: [22, 3] }}
        width={900}
        height={900}
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 10 }}
      >
        <defs>
          <filter id="countryGlow">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="dotPulse">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <Geographies geography={GEO_URL}>
          {({ geographies, projection }) =>
            geographies
              .filter((geo) => padIso(geo.id) in AFRICA_ISO)
              .map((geo) => {
                const iso = padIso(geo.id);
                const meta = AFRICA_ISO[iso];
                const name = meta.name;
                const region = meta.region;
                const isSelected = selectedCountry === name;
                const isHovered = hoveredCountry === name;
                const isActive = isSelected || isHovered;
                const isRegionMate =
                  (selectedRegion && region === selectedRegion && !isSelected) ||
                  (hoveredRegion && region === hoveredRegion && !isHovered);

                let labelX = 0;
                let labelY = 0;
                const showLabel = labelSet.has(name);
                if (showLabel) {
                  // Resolve the lon/lat centroid once and cache it; only the
                  // (cheap) projection runs on subsequent renders.
                  let lonLat = centroidCache.current[geo.rsmKey];
                  if (lonLat === undefined) {
                    lonLat = null;
                    try {
                      const coords = geo.geometry.type === 'MultiPolygon'
                        ? (geo.geometry as any).coordinates[0][0]
                        : (geo.geometry as any).coordinates[0];
                      let sx = 0, sy = 0;
                      for (const [lon, lat] of coords) { sx += lon; sy += lat; }
                      lonLat = [sx / coords.length, sy / coords.length];
                    } catch { /* noop */ }
                    centroidCache.current[geo.rsmKey] = lonLat;
                  }
                  if (lonLat) {
                    const projected = projection(lonLat);
                    if (projected) { labelX = projected[0]; labelY = projected[1]; }
                  }
                }

                return (
                  <g key={geo.rsmKey}>
                    <Geography
                      geography={geo}
                      onClick={() => onCountrySelect(name)}
                      onMouseEnter={(e: React.MouseEvent) => onCountryEnter(e, name, region)}
                      onMouseLeave={onLeave}
                      style={{
                        default: {
                          fill: isSelected
                            ? 'rgba(34,197,94,0.45)'
                            : isRegionMate
                              ? REGION_TINT[region]
                              : 'rgba(255,255,255,0.06)',
                          stroke: isSelected
                            ? '#22C55E'
                            : isRegionMate
                              ? REGION_HEX[region] + '60'
                              : 'rgba(255,255,255,0.18)',
                          strokeWidth: isSelected ? 1.4 : 0.6,
                          outline: 'none',
                          transition: 'fill 0.25s, stroke 0.25s',
                          filter: isSelected ? 'url(#countryGlow)' : undefined,
                        },
                        hover: {
                          fill: REGION_HEX[region] + '40',
                          stroke: REGION_HEX[region],
                          strokeWidth: 1.1,
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        pressed: {
                          fill: REGION_HEX[region] + '60',
                          stroke: REGION_HEX[region],
                          strokeWidth: 1.3,
                          outline: 'none',
                        },
                      }}
                    />
                    {showLabel && labelX !== 0 && (
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="pointer-events-none select-none"
                        style={{
                          fontSize: isActive ? '11px' : '9px',
                          fontWeight: isActive ? 700 : 500,
                          fill: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                          letterSpacing: '0.02em',
                          transition: 'all 0.2s',
                          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                        }}
                      >
                        {name === 'South Africa' ? 'S. Africa'
                          : name === 'Central African Republic' ? 'CAR'
                          : name === 'Democratic Republic of the Congo' ? 'DRC'
                          : name === 'South Sudan' ? 'S. Sudan'
                          : name === 'São Tomé and Príncipe' ? ''
                          : name === 'Republic of the Congo' ? 'Congo'
                          : name}
                      </text>
                    )}
                  </g>
                );
              })
          }
        </Geographies>

        {/* Capital-city pulse dots — one per AU member state.
            Rendered AFTER the geographies, so they paint on top. They MUST NOT
            capture pointer events or they swallow clicks/hovers meant for the
            country shapes beneath them. The whole <g> is pointer-events: none.
            Only the *selected* dot animates, to keep continuous SMIL repaints
            (the main scroll-jank culprit) down from 54 to at most one. */}
        <g style={{ pointerEvents: 'none' }}>
          {Object.values(AFRICA_ISO).map(({ name, region, capital }) => {
            const isSelected = selectedCountry === name;
            const isHovered = hoveredCountry === name;
            const color = REGION_HEX[region];
            return (
              <Marker key={`cap-${name}`} coordinates={capital}>
                {/* Outer halo — only the selected country pulses */}
                <circle r={isSelected ? 7 : 4} fill={color} fillOpacity={isSelected ? 0.15 : 0.12}>
                  {isSelected && (
                    <>
                      <animate
                        attributeName="r"
                        values="7;14;7"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="fill-opacity"
                        values="0.45;0;0.45"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                    </>
                  )}
                </circle>
                {/* Inner solid dot */}
                <circle r={isSelected ? 3 : isHovered ? 2.4 : 1.6} fill={color} stroke="#0a0e14" strokeWidth={0.5} />
              </Marker>
            );
          })}
        </g>
      </ComposableMap>

      {/* Compass rose — top right */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none">
        <svg width="56" height="56" viewBox="0 0 56 56" className="opacity-50">
          <circle cx="28" cy="28" r="26" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* N pointer */}
          <polygon points="28,6 25,28 28,24 31,28" fill="#22C55E" />
          {/* S pointer */}
          <polygon points="28,50 25,28 28,32 31,28" fill="rgba(255,255,255,0.3)" />
          <text x="28" y="13" textAnchor="middle" fontSize="9" fill="#22C55E" fontWeight="700" fontFamily="monospace">N</text>
          <text x="28" y="48" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)" fontWeight="600" fontFamily="monospace">S</text>
          <text x="48" y="31" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)" fontWeight="600" fontFamily="monospace">E</text>
          <text x="8" y="31" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)" fontWeight="600" fontFamily="monospace">W</text>
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredCountry && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700/60 rounded-lg px-3 py-2 shadow-2xl">
            <p className="text-xs font-semibold text-white whitespace-nowrap">{hoveredCountry}</p>
            {hoveredRegion && (
              <p
                className="text-[10px] mt-0.5 uppercase tracking-wider"
                style={{ color: REGION_HEX[hoveredRegion] }}
              >
                {hoveredRegion} Africa
              </p>
            )}
            <p className="text-[10px] text-gray-500 mt-0.5">Click to filter data</p>
          </div>
        </div>
      )}

      {/* Region legend (bottom left) */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/50 backdrop-blur rounded-lg px-3 py-2.5 border border-white/[0.08]">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">5 Regions · 54 Countries</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          {(['North', 'West', 'Central', 'East', 'Southern'] as Region[]).map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: REGION_HEX[r] }} />
              <span className="text-gray-300">{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats panel (bottom right) */}
      <div className="absolute bottom-4 right-4 z-10 bg-black/50 backdrop-blur rounded-lg px-3 py-2.5 border border-white/[0.08] min-w-[140px]">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5 font-semibold">Continent Snapshot</p>
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between gap-3"><span className="text-gray-500">Countries with data</span><span className="text-emerald-400 font-semibold tabular-nums">{fmtNum(platformStats?.countriesWithData)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-gray-500">Indicators tracked</span><span className="text-white font-semibold tabular-nums">{fmtNum(platformStats?.totalIndicators)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-gray-500">Data points</span><span className="text-white font-semibold tabular-nums">{fmtNum(platformStats?.totalDataPoints)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-gray-500">Years covered</span><span className="text-white font-semibold tabular-nums">{yearRange}</span></div>
        </div>
      </div>

      {/* Scale indicator (top left, subtle) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-mono">Equirectangular · Mercator</div>
      </div>
    </div>
  );
};

export default AfricaMap;
