// ============================================
// AFRICAN YOUTH OBSERVATORY - AI INSIGHTS COMPONENTS
// Visual components for displaying AI-generated insights
// ============================================

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  Lightbulb,
  Target,
  ArrowRight,
  BarChart3,
  BookOpen,
  Heart,
  Briefcase,
  Users,
  Globe,
  Brain,
  Zap,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  generateInsights,
  getHighPriorityInsights,
  getInsightSummary,
  getCountryInsights,
  type AIInsight,
  type InsightType,
  type InsightCategory,
  type InsightPriority,
} from '@/services/insights';
import { getCountryById } from '@/types';

// ============================================
// INSIGHT CARD COMPONENT
// ============================================

interface InsightCardProps {
  insight: AIInsight;
  variant?: 'compact' | 'full';
  onViewDetails?: () => void;
}

const typeIcons: Record<InsightType, React.ElementType> = {
  trend: TrendingUp,
  comparison: BarChart3,
  achievement: Award,
  concern: AlertTriangle,
  opportunity: Lightbulb,
  recommendation: Target,
};

const typeColors: Record<InsightType, { bg: string; text: string; border: string }> = {
  trend: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  comparison: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  achievement: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
  concern: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  opportunity: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  recommendation: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
};

const categoryIcons: Record<InsightCategory, React.ElementType> = {
  overall: Globe,
  education: BookOpen,
  health: Heart,
  employment: Briefcase,
  innovation: Zap,
  civic: Users,
  regional: Globe,
};

const priorityBadges: Record<InsightPriority, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
  high: { variant: 'default', label: 'High Priority' },
  medium: { variant: 'secondary', label: 'Medium' },
  low: { variant: 'outline', label: 'Low' },
};

export const InsightCard: React.FC<InsightCardProps> = ({ 
  insight, 
  variant = 'full',
  onViewDetails 
}) => {
  const Icon = typeIcons[insight.type];
  const CategoryIcon = categoryIcons[insight.category];
  const colors = typeColors[insight.type];
  const priorityBadge = priorityBadges[insight.priority];

  if (variant === 'compact') {
    return (
      <div 
        className={`p-4 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer hover:shadow-md transition-shadow`}
        onClick={onViewDetails}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${colors.text} line-clamp-2`}>
              {insight.title}
            </p>
            {insight.value && (
              <p className="text-lg font-bold mt-1">{insight.value}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <Card className={`${colors.border} border-l-4 overflow-hidden`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${colors.bg} flex-shrink-0`}>
            <Icon className={`h-6 w-6 ${colors.text}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge variant={priorityBadge.variant} className="text-xs">
                {priorityBadge.label}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                <CategoryIcon className="h-3 w-3 mr-1" />
                {insight.category}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                {insight.confidence}% confidence
              </span>
            </div>
            
            <h3 className={`font-semibold text-lg ${colors.text} mb-2`}>
              {insight.title}
            </h3>
            
            <p className="text-sm text-muted-foreground mb-3">
              {insight.description}
            </p>
            
            {insight.metric && insight.value && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg} mb-3`}>
                <span className="text-xs text-muted-foreground">{insight.metric}:</span>
                <span className={`text-lg font-bold ${colors.text}`}>{insight.value}</span>
                {insight.change !== undefined && (
                  <span className={`text-xs ${insight.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {insight.change > 0 ? '+' : ''}{insight.change}
                  </span>
                )}
              </div>
            )}
            
            {insight.recommendation && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Recommendation</p>
                    <p className="text-sm">{insight.recommendation}</p>
                  </div>
                </div>
              </div>
            )}
            
            {insight.countries && insight.countries.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">Countries:</span>
                {insight.countries.slice(0, 4).map(countryId => {
                  const country = getCountryById(countryId);
                  return country && (
                    <Badge key={countryId} variant="outline" className="text-xs">
                      {country.flagEmoji} {country.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// INSIGHTS DASHBOARD
// ============================================

interface InsightsDashboardProps {
  year?: number;
  countryId?: string;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ 
  year = 2024,
  countryId 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const allInsights = useMemo(() => {
    if (countryId) {
      return getCountryInsights(countryId, year);
    }
    return generateInsights(year);
  }, [year, countryId]);

  const summary = useMemo(() => getInsightSummary(year), [year]);
  const highPriority = useMemo(() => getHighPriorityInsights(year), [year]);

  const filteredInsights = useMemo(() => {
    let filtered = allInsights;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }
    if (selectedType !== 'all') {
      filtered = filtered.filter(i => i.type === selectedType);
    }
    
    return filtered;
  }, [allInsights, selectedCategory, selectedType]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">AI-Powered Insights</h2>
            <Badge variant="secondary" className="ml-2">
              <Sparkles className="h-3 w-3 mr-1" />
              Powered by AYO Analytics
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Intelligent analysis of youth development data across Africa
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Insights
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Insights</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalInsights}</p>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">High Priority</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.highPriority}</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Achievements</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{summary.achievements}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Opportunities</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.opportunities}</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Trends</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.trends}</p>
          </CardContent>
        </Card>
      </div>

      {/* High Priority Insights */}
      {highPriority.length > 0 && !countryId && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Priority Insights Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {highPriority.slice(0, 3).map(insight => (
                <InsightCard key={insight.id} insight={insight} variant="compact" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="overall">Overall</SelectItem>
            <SelectItem value="education">Education</SelectItem>
            <SelectItem value="health">Health</SelectItem>
            <SelectItem value="employment">Employment</SelectItem>
            <SelectItem value="innovation">Innovation</SelectItem>
            <SelectItem value="civic">Civic</SelectItem>
            <SelectItem value="regional">Regional</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="trend">Trends</SelectItem>
            <SelectItem value="achievement">Achievements</SelectItem>
            <SelectItem value="concern">Concerns</SelectItem>
            <SelectItem value="opportunity">Opportunities</SelectItem>
            <SelectItem value="recommendation">Recommendations</SelectItem>
            <SelectItem value="comparison">Comparisons</SelectItem>
          </SelectContent>
        </Select>

        {(selectedCategory !== 'all' || selectedType !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setSelectedCategory('all'); setSelectedType('all'); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Insights List */}
      <div className="grid gap-4">
        {filteredInsights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
        
        {filteredInsights.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                No insights found for the selected filters.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// ============================================
// QUICK INSIGHTS WIDGET
// ============================================

interface QuickInsightsProps {
  limit?: number;
  year?: number;
}

export const QuickInsights: React.FC<QuickInsightsProps> = ({ 
  limit = 3,
  year = 2024 
}) => {
  const insights = useMemo(() => {
    const all = generateInsights(year);
    return all
      .filter(i => i.priority === 'high')
      .slice(0, limit);
  }, [year, limit]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Insights
        </CardTitle>
        <CardDescription>
          Key findings from youth development data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map(insight => (
            <InsightCard 
              key={insight.id} 
              insight={insight} 
              variant="compact" 
            />
          ))}
        </div>
        <Button variant="ghost" className="w-full mt-4" size="sm">
          View All Insights
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default InsightsDashboard;
