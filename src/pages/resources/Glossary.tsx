import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, BookOpen } from 'lucide-react';
import { Content } from '@/components/cms';
import { useContentText } from '@/contexts/ContentContext';

const glossaryTerms = [
  { slug: 'ayi', term: 'African Youth Index (AYI)', definition: 'A composite indicator developed by AYO that ranks African countries based on youth development outcomes across education, employment, health, and civic engagement.', category: 'Indices' },
  { slug: 'youth', term: 'Youth', definition: 'In the context of AYO, youth refers to individuals aged 15–35, consistent with the African Union definition codified in the African Youth Charter. The UN\'s narrower 15–24 band remains queryable for cross-reference.', category: 'Demographics' },
  { slug: 'neet', term: 'NEET Rate', definition: 'The share of young people (15–35) who are Not in Education, Employment, or Training. A key indicator of youth economic exclusion.', category: 'Employment' },
  { slug: 'unemployment', term: 'Youth Unemployment Rate', definition: 'The percentage of the youth labour force (15–35) that is without work but available and seeking employment.', category: 'Employment' },
  { slug: 'lfp', term: 'Labor Force Participation Rate', definition: 'The percentage of youth population (15–35) that is either employed or actively seeking employment.', category: 'Employment' },
  { slug: 'gpi', term: 'Gender Parity Index (GPI)', definition: 'A ratio of female to male values for a given indicator, used to measure gender equality in education and employment.', category: 'Gender' },
  { slug: 'ger', term: 'Gross Enrollment Ratio (GER)', definition: 'Total enrollment in a specific level of education, regardless of age, expressed as a percentage of the eligible official school-age population. Can exceed 100% when over- or under-age students are enrolled.', category: 'Education' },
  { slug: 'ner', term: 'Net Enrollment Ratio (NER)', definition: 'Enrollment of the official age group for a given level of education expressed as a percentage of the corresponding population.', category: 'Education' },
  { slug: 'literacy', term: 'Youth Literacy Rate', definition: 'The percentage of people aged 15–35 who can read and write a short, simple statement about their everyday life.', category: 'Education' },
  { slug: 'informal', term: 'Informal Employment', definition: 'Employment in the informal sector or informal employment outside the informal sector, typically lacking social protection and formal contracts.', category: 'Employment' },
  { slug: 'dependency', term: 'Youth Dependency Ratio', definition: 'The ratio of youth (15–35) to the working-age population, indicating the demographic burden on the economy.', category: 'Demographics' },
  { slug: 'urban', term: 'Urban Youth', definition: 'Young people residing in areas classified as urban according to national definitions, typically characterized by higher population density.', category: 'Demographics' },
  { slug: 'hiv', term: 'HIV Prevalence', definition: 'The percentage of people living with HIV in a specific population group, often measured among youth aged 15–35.', category: 'Health' },
  { slug: 'yfhs', term: 'Youth-Friendly Health Services', definition: "Health services designed to be accessible, acceptable, and appropriate for young people's needs.", category: 'Health' },
  { slug: 'early_entrepreneurship', term: 'Early-Stage Entrepreneurship', definition: 'The rate of adults aged 18-24 who are either nascent entrepreneurs or owner-managers of new businesses.', category: 'Entrepreneurship' },
  { slug: 'finance', term: 'Access to Finance', definition: 'The availability and accessibility of formal financial services (banks, microfinance) to young entrepreneurs.', category: 'Entrepreneurship' },
  { slug: 'provenance', term: 'Data Provenance', definition: 'Documentation of the origin, methodology, and transformation history of data, ensuring transparency and trust.', category: 'Data Quality' },
  { slug: 'credibility', term: 'Credibility Score', definition: 'A rating assigned to datasets based on source reliability, methodology rigor, and verification status.', category: 'Data Quality' },
];

const categories = ['All', 'Demographics', 'Education', 'Employment', 'Health', 'Entrepreneurship', 'Gender', 'Indices', 'Data Quality'];

const Glossary = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const searchPlaceholder = useContentText('glossary.search.placeholder', 'Search terms...');
  const noResults = useContentText('glossary.empty.message', 'No terms found matching your search.');

  const filteredTerms = glossaryTerms.filter(item => {
    const matchesSearch = item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.definition.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <header className="gradient-hero py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <Content as="h1" id="glossary.header.title" fallback="Glossary" className="section-title" />
          </div>
          <Content
            as="p"
            id="glossary.header.subtitle"
            fallback="Definitions of key terms, indicators, and concepts used in the African Youth Observatory."
            className="section-description"
          />
        </div>
      </header>

      <div className="py-6 md:py-8">
        <div className="container px-4 md:px-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Terms List */}
          <div className="space-y-4">
            {filteredTerms.map((item) => (
              <Card key={item.slug} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <Content
                          as="h3"
                          id={`glossary.term.${item.slug}.term`}
                          fallback={item.term}
                          className="font-bold text-base md:text-lg"
                        />
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {item.category}
                        </span>
                      </div>
                      <Content
                        as="p"
                        id={`glossary.term.${item.slug}.definition`}
                        fallback={item.definition}
                        className="text-sm text-muted-foreground"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTerms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{noResults}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Glossary;
