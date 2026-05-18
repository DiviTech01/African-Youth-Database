import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, Calendar, Tag, Search, Filter, Star, Code, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useExportGuard } from '@/hooks/useExportGuard';
import { GuestInviteModal } from '@/components/GuestInviteModal';
import { Content } from '@/components/cms';
import { useContentText } from '@/contexts/ContentContext';
import {
  getAdminReports, downloadDataUrl, incrementReportDownloads, inferFormat,
} from '@/services/adminContent';

type ReportType = 'Country Report' | 'Thematic Report' | 'Regional Report';

const reportTypeAccent: Record<ReportType, { bg: string; text: string; ring: string; hex: string }> = {
  'Country Report':  { bg: 'bg-blue-500/15',   text: 'text-blue-400',   ring: 'border-blue-500/30',   hex: '#3B82F6' },
  'Thematic Report': { bg: 'bg-purple-500/15', text: 'text-purple-400', ring: 'border-purple-500/30', hex: '#A855F7' },
  'Regional Report': { bg: 'bg-amber-500/15',  text: 'text-amber-400',  ring: 'border-amber-500/30',  hex: '#F59E0B' },
};

const reports = [
  {
    id: 1,
    title: "African Youth Index 2024",
    description: "Comprehensive ranking of African countries based on youth development indicators across education, employment, health, and civic engagement.",
    category: "Annual Report",
    type: "Thematic Report" as ReportType,
    theme: "General",
    year: 2024,
    date: "2024-11-15",
    featured: true,
    downloads: 2847,
    format: ["PDF", "XLSX"]
  },
  {
    id: 2,
    title: "Youth Employment Outlook: Sub-Saharan Africa",
    description: "Analysis of youth labor market trends, unemployment patterns, and emerging opportunities across Sub-Saharan African economies.",
    category: "Thematic Brief",
    type: "Regional Report" as ReportType,
    theme: "Employment",
    year: 2024,
    date: "2024-10-02",
    featured: true,
    downloads: 1523,
    format: ["PDF"]
  },
  {
    id: 3,
    title: "Education Access and Quality Report",
    description: "Examining educational attainment, enrollment rates, and learning outcomes for African youth aged 15-35.",
    category: "Thematic Brief",
    type: "Thematic Report" as ReportType,
    theme: "Education",
    year: 2024,
    date: "2024-09-18",
    featured: false,
    downloads: 1102,
    format: ["PDF", "DOCX"]
  },
  {
    id: 4,
    title: "Youth Health and Wellbeing Dashboard",
    description: "Interactive report on youth health indicators including access to healthcare, mental health, and nutrition status.",
    category: "Dashboard Report",
    type: "Country Report" as ReportType,
    theme: "Health",
    year: 2023,
    date: "2023-12-05",
    featured: false,
    downloads: 892,
    format: ["PDF"]
  },
  {
    id: 5,
    title: "Youth Entrepreneurship Ecosystem Analysis",
    description: "Mapping the startup landscape and entrepreneurial activity among young Africans across all 54 countries.",
    category: "Thematic Brief",
    type: "Thematic Report" as ReportType,
    theme: "Entrepreneurship",
    year: 2023,
    date: "2023-08-22",
    featured: true,
    downloads: 1341,
    format: ["PDF", "XLSX"]
  },
  {
    id: 6,
    title: "Regional Comparison: East vs West Africa",
    description: "Comparative analysis of youth development metrics between East and West African regions.",
    category: "Comparative Study",
    type: "Regional Report" as ReportType,
    theme: "General",
    year: 2023,
    date: "2023-07-10",
    featured: false,
    downloads: 654,
    format: ["PDF"]
  },
  {
    id: 7,
    title: "Gender Parity in Youth Development",
    description: "Examining gender gaps in education, employment, and economic opportunities for young men and women.",
    category: "Special Report",
    type: "Thematic Report" as ReportType,
    theme: "General",
    year: 2024,
    date: "2024-06-30",
    featured: false,
    downloads: 987,
    format: ["PDF", "XLSX"]
  },
  {
    id: 8,
    title: "Youth Population Projections 2030-2050",
    description: "Demographic forecasting and analysis of Africa's youth bulge and its implications for development.",
    category: "Technical Report",
    type: "Country Report" as ReportType,
    theme: "Population",
    year: 2024,
    date: "2024-03-14",
    featured: false,
    downloads: 1205,
    format: ["PDF"]
  }
];

const categories = ["All Categories", "Annual Report", "Thematic Brief", "Dashboard Report", "Comparative Study", "Special Report", "Technical Report"];
const themes = ["All Themes", "General", "Population", "Education", "Health", "Employment", "Entrepreneurship"];
const years = ["All Years", "2024", "2023", "2022", "2021"];

const Reports = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedTheme, setSelectedTheme] = useState('All Themes');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const { toast } = useToast();
  const { guard, inviteOpen, setInviteOpen, inviteAction } = useExportGuard();

  // Merge admin-uploaded reports with the hardcoded fallback list. Admin
  // reports come first (newest at the top, by updatedAt). The reports
  // array is reactive to localStorage changes via the activeReports memo.
  const adminReports = useMemo(() => getAdminReports(), []);
  const allReports = useMemo(() => {
    const adminMapped = adminReports.map((a) => ({
      id: a.id as number | string,
      title: a.title,
      description: a.description,
      category: a.category,
      type: a.type as ReportType,
      theme: a.theme,
      year: a.year,
      date: a.date,
      featured: a.featured,
      downloads: a.downloads,
      format: a.files.length > 0 ? Array.from(new Set(a.files.map((f) => inferFormat(f.name)))) : ['PDF'],
      _adminFiles: a.files,
    }));
    return [...adminMapped, ...reports.map((r) => ({ ...r, _adminFiles: undefined as any }))];
  }, [adminReports]);
  const toastTitle = useContentText('reports.toast.embed_copied_title', 'Embed code copied!');
  const toastDescTemplate = useContentText(
    'reports.toast.embed_copied_description',
    'Embed code for "{title}" has been copied to your clipboard.',
  );
  const searchPlaceholder = useContentText('reports.search.placeholder', 'Search reports...');

  const handleDownload = (report: any, format?: string) => {
    // If this is an admin-uploaded report with real files, serve the file directly
    const adminFiles: { name: string; type: string; dataUrl: string; size: number }[] | undefined = report._adminFiles;
    if (adminFiles && adminFiles.length > 0) {
      guard(
        () => {
          const target = format
            ? adminFiles.find((f) => inferFormat(f.name) === format) ?? adminFiles[0]
            : adminFiles[0];
          downloadDataUrl(target.dataUrl, target.name);
          incrementReportDownloads(String(report.id));
          toast({ title: 'Downloaded', description: target.name });
        },
        'download',
      );
      return;
    }
    guard(
      () => toast({
        title: 'Download coming soon',
        description: format
          ? `${format} download for "${report.title}" will be available shortly.`
          : `"${report.title}" download will be available shortly.`,
      }),
      'download',
    );
  };

  const handleCopyEmbed = (report: any) => {
    const embedCode = `<iframe src="https://ayd.africa/embed/report/${report.id}" width="600" height="400" frameborder="0" title="${report.title}"></iframe>`;
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopiedId(report.id);
      toast({
        title: toastTitle,
        description: toastDescTemplate.replace('{title}', report.title),
      });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredReports = allReports.filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          report.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || report.category === selectedCategory;
    const matchesTheme = selectedTheme === 'All Themes' || report.theme === selectedTheme;
    const matchesYear = selectedYear === 'All Years' || report.year.toString() === selectedYear;
    return matchesSearch && matchesCategory && matchesTheme && matchesYear;
  });

  const featuredReports = allReports.filter(r => r.featured);

  return (
    <>
      <GuestInviteModal open={inviteOpen} onOpenChange={setInviteOpen} action={inviteAction} />
      <header className="relative pt-6 pb-3 md:pt-8 md:pb-4 overflow-hidden">
        <div className="absolute inset-0 opacity-30 w-full bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:6rem_5rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="container px-4 md:px-6 relative z-10">
          <Content
            as="h1"
            id="reports.header.title"
            fallback="Reports & Publications"
            className="text-2xl sm:text-3xl font-semibold tracking-tighter mb-2 bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent"
          />
          <Content
            as="p"
            id="reports.header.subtitle"
            fallback="Access our latest reports, thematic briefs, and data publications on African youth development."
            className="text-sm sm:text-base text-[#A89070]"
          />
        </div>
      </header>

      <div className="pt-2 md:pt-3 pb-6 md:pb-8">
        <div className="container px-4 md:px-6">
          {/* Hero stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {(() => {
              const totalDownloads = allReports.reduce((s, r) => s + r.downloads, 0);
              const latestYear = Math.max(...allReports.map((r) => r.year));
              const themeCount = new Set(allReports.map((r) => r.theme)).size;
              const stats = [
                { icon: FileText, label: 'Publications', value: allReports.length.toString(), accent: '#D4A017' },
                { icon: Download, label: 'Total downloads', value: totalDownloads.toLocaleString(), accent: '#22C55E' },
                { icon: Tag, label: 'Themes covered', value: themeCount.toString(), accent: '#A855F7' },
                { icon: Calendar, label: 'Latest edition', value: latestYear.toString(), accent: '#3B82F6' },
              ];
              return stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-2xl p-4 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-gray-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.accent + '20', color: s.accent }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold tabular-nums leading-none truncate" style={{ color: s.accent }}>{s.value}</p>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mt-1">{s.label}</p>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Featured Publications */}
          {featuredReports.length > 0 && (
            <section className="mb-7">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-[#D4A017] fill-[#D4A017]" />
                  <Content as="span" id="reports.featured.heading" fallback="Featured Publications" />
                </h2>
                <span className="text-[11px] text-gray-500 tabular-nums">{featuredReports.length} items</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featuredReports.map((report) => {
                  const accent = reportTypeAccent[report.type];
                  return (
                    <article
                      key={report.id}
                      className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#D4A017]/[0.06] to-white/[0.01] border border-[#D4A017]/30 hover:border-[#D4A017]/60 transition-all p-5 flex flex-col"
                    >
                      <div className="absolute top-3 right-3">
                        <Star className="h-3.5 w-3.5 text-[#D4A017] fill-[#D4A017]" />
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${accent.bg} ${accent.text} border ${accent.ring}`}>
                          {report.type}
                        </span>
                        <span className="text-[11px] text-gray-500 tabular-nums">{report.year}</span>
                      </div>
                      <h3 className="font-bold text-base text-white mb-2 line-clamp-2 leading-tight">{report.title}</h3>
                      <p className="text-xs text-gray-400 mb-4 line-clamp-3 leading-relaxed flex-grow">{report.description}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                        <span className="text-[11px] text-gray-500 inline-flex items-center gap-1.5">
                          <Download className="h-3 w-3" />
                          <span className="tabular-nums">{report.downloads.toLocaleString()}</span>
                        </span>
                        <Button size="sm" className="gap-1.5 h-7 text-xs px-3" onClick={() => handleDownload(report)}>
                          <Download className="h-3 w-3" />
                          <Content as="span" id="reports.download_button" fallback="Download" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Compact filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-white/[0.03] border-gray-800"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs bg-white/[0.03] border-gray-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTheme} onValueChange={setSelectedTheme}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs bg-white/[0.03] border-gray-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme} value={theme} className="text-xs">{theme}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[110px] h-9 text-xs bg-white/[0.03] border-gray-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year} className="text-xs">{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Result count */}
          <p className="text-xs text-gray-500 mb-4 inline-flex items-center gap-1">
            <Filter className="h-3 w-3" />
            <span className="text-gray-300 font-semibold tabular-nums">{filteredReports.length}</span>
            of <span className="text-gray-300 font-semibold tabular-nums">{allReports.length}</span>
            <Content as="span" id="reports.all.heading_inline" fallback="publications" />
          </p>

          {/* All Reports — refined card grid */}
          {filteredReports.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
              <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-300">No publications match your filters</p>
              <p className="text-xs text-gray-500 mt-1">Try clearing search or widening the filters above.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredReports.map((report) => {
                const accent = reportTypeAccent[report.type];
                return (
                  <article
                    key={report.id}
                    className="group relative rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-gray-800/80 hover:border-gray-700 transition-all flex flex-col overflow-hidden"
                  >
                    {/* Type accent stripe */}
                    <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent.hex}aa, transparent)` }} />
                    <div className="p-4 flex flex-col flex-grow">
                      <div className="flex items-start gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent.hex + '20', color: accent.hex }}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${accent.bg} ${accent.text}`}>
                            {report.type.replace(' Report', '')}
                          </span>
                          <p className="text-[10px] text-gray-500 mt-1 truncate">{report.category}</p>
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-white mb-1.5 line-clamp-2 leading-tight">{report.title}</h3>
                      <p className="text-[11px] text-gray-400 mb-3 line-clamp-2 leading-relaxed flex-grow">{report.description}</p>

                      <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className="tabular-nums">{new Date(report.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                        </span>
                        <span className="text-gray-700">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Download className="h-3 w-3" />
                          {report.downloads.toLocaleString()}
                        </span>
                      </div>

                      {/* Action row — flex with download buttons grouped + embed icon-only */}
                      <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-white/[0.04]">
                        <div className="flex gap-1 flex-1 min-w-0">
                          {report.format.map((format) => (
                            <Button
                              key={format}
                              variant="outline"
                              size="sm"
                              className="gap-1 text-[10px] h-7 px-2 flex-1 min-w-0 border-gray-800 bg-white/[0.02]"
                              onClick={() => handleDownload(report, format)}
                            >
                              <Download className="h-3 w-3 flex-shrink-0" />
                              {format}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-[#D4A017]"
                          onClick={() => handleCopyEmbed(report)}
                          title="Copy embed code"
                        >
                          {copiedId === report.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Code className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Reports;
