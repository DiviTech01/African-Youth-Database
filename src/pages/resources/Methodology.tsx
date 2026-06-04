import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Database, Shield, Calculator, RefreshCw, CheckCircle } from 'lucide-react';
import { Content } from '@/components/cms';

const QA_CARDS = [
  { slug: 'source', title: '1. Source Verification', body: 'Confirm data origin from official or peer-reviewed sources. Verify methodology documentation is available.' },
  { slug: 'validation', title: '2. Data Validation', body: 'Cross-check values against multiple sources. Flag outliers for manual review.' },
  { slug: 'consistency', title: '3. Consistency Checks', body: 'Verify temporal consistency (no illogical year-over-year changes). Check against related indicators.' },
  { slug: 'credibility', title: '4. Credibility Scoring', body: 'Assign 1-5 star rating based on source reliability, methodology rigor, and recency.' },
];

const Methodology = () => {
  return (
    <>
      <header className="gradient-hero py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <Content as="h1" id="methodology.header.title" fallback="Methodology" className="section-title" />
          </div>
          <Content
            as="p"
            id="methodology.header.subtitle"
            fallback="Understand how we collect, process, and validate youth data across Africa."
            className="section-description"
          />
        </div>
      </header>

      <div className="py-6 md:py-8">
        <div className="container px-4 md:px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <Content as="span" id="methodology.overview.title" fallback="Data Collection Overview" />
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <Content
                  as="div"
                  id="methodology.overview.body"
                  fallback={
                    <>
                      <p>
                        The African Youth Observatory aggregates youth-focused statistics from a diverse range of authoritative sources.
                        Our data collection methodology is designed to ensure comprehensiveness, accuracy, and comparability across
                        all 54 African countries.
                      </p>
                      <h4 className="text-foreground font-semibold mt-4">Primary Data Sources</h4>
                      <ul className="space-y-2">
                        <li><strong>National Statistical Offices:</strong> Census data, labor force surveys, household surveys</li>
                        <li><strong>UN Agencies:</strong> UNDP Human Development Reports, UNESCO education statistics, ILO labor data, UNICEF surveys</li>
                        <li><strong>World Bank:</strong> World Development Indicators, Enterprise Surveys</li>
                        <li><strong>African Development Bank:</strong> African Economic Outlook, African Statistical Yearbook</li>
                        <li><strong>DHS Program:</strong> Demographic and Health Surveys</li>
                        <li><strong>Academic Research:</strong> Peer-reviewed studies and specialized youth surveys</li>
                      </ul>
                    </>
                  }
                />
              </CardContent>
            </Card>

            {/* Standardization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <Content as="span" id="methodology.standardization.title" fallback="Standardization Process" />
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <Content
                  as="div"
                  id="methodology.standardization.body"
                  fallback={
                    <>
                      <p>To enable cross-country comparison, we apply rigorous standardization procedures:</p>
                      <h4 className="text-foreground font-semibold mt-4">Age Definition</h4>
                      <p>
                        Our canonical youth band is <strong>15–35</strong>, consistent with the African Union (AU)
                        definition and the African Youth Charter. All headline statistics across the platform —
                        Key Statistics on the landing page, country profiles, the Youth Index, theme rollups,
                        Compare, and Explore — query <strong>ageGroup = 15–35</strong> by default.
                        The UN's narrower 15–24 band remains queryable on the Explore page for cross-reference,
                        and disaggregated 5-year brackets (15–19, 20–24, 25–29, 30–35) are exposed where source data
                        ships them.
                      </p>
                      <h4 className="text-foreground font-semibold mt-4">Indicator Harmonization</h4>
                      <ul className="space-y-1">
                        <li>Standardized indicator definitions aligned with international statistical standards</li>
                        <li>Consistent calculation methodologies across countries</li>
                        <li>Currency conversions to USD using World Bank exchange rates</li>
                        <li>PPP adjustments for economic comparisons where appropriate</li>
                      </ul>
                      <h4 className="text-foreground font-semibold mt-4">Temporal Alignment</h4>
                      <p>
                        Data points are aligned to calendar years. Multi-year surveys are assigned to the midpoint year.
                        When the latest data is not available for a country, we display the most recent available year
                        with clear vintage labeling.
                      </p>
                    </>
                  }
                />
              </CardContent>
            </Card>

            {/* Quality Assurance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <Content as="span" id="methodology.qa.title" fallback="Quality Assurance" />
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <Content
                  as="p"
                  id="methodology.qa.intro"
                  fallback="Every dataset undergoes a multi-stage quality assurance process:"
                />
                <div className="grid md:grid-cols-2 gap-4 mt-4 not-prose">
                  {QA_CARDS.map((c) => (
                    <div key={c.slug} className="p-4 bg-muted rounded-lg">
                      <Content
                        as="h5"
                        id={`methodology.qa.${c.slug}.title`}
                        fallback={c.title}
                        className="font-semibold text-foreground mb-2"
                      />
                      <Content
                        as="p"
                        id={`methodology.qa.${c.slug}.body`}
                        fallback={c.body}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* African Youth Index */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <Content as="span" id="methodology.ayi.title" fallback="African Youth Index Methodology" />
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <Content
                  as="p"
                  id="methodology.ayi.intro"
                  fallback="The African Youth Index (AYI) is a composite indicator developed by AYO to provide a comprehensive measure of youth development across African countries."
                />
                <h4 className="text-foreground font-semibold mt-4">Dimensions & Indicators</h4>
                <div className="not-prose overflow-x-auto">
                  <table className="min-w-full text-sm mt-2">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-semibold text-foreground">Dimension</th>
                        <th className="text-left py-2 font-semibold text-foreground">Weight</th>
                        <th className="text-left py-2 font-semibold text-foreground">Key Indicators</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2">Youth Demography &amp; Participation</td>
                        <td className="py-2 font-semibold">20%</td>
                        <td className="py-2">Population share, voter turnout, parliamentary representation, trust in government, freedom of association, AYC policy markers</td>
                      </tr>
                      <tr>
                        <td className="py-2">Education</td>
                        <td className="py-2 font-semibold">15%</td>
                        <td className="py-2">Literacy, primary / secondary / tertiary enrollment, dropout, teacher–student ratio, education spending</td>
                      </tr>
                      <tr>
                        <td className="py-2">Employment</td>
                        <td className="py-2 font-semibold">15%</td>
                        <td className="py-2">Unemployment, labor-force participation, employment-to-population ratio, sectoral split, informal employment</td>
                      </tr>
                      <tr>
                        <td className="py-2">Health</td>
                        <td className="py-2 font-semibold">15%</td>
                        <td className="py-2">Skilled birth attendance, physician density, HIV prevalence + treatment, contraceptive prevalence, mortality (suicide, AIDS, accidents, substance abuse), maternal mortality, health spending</td>
                      </tr>
                      <tr>
                        <td className="py-2">Entrepreneurship</td>
                        <td className="py-2 font-semibold">15%</td>
                        <td className="py-2">Startup survival, microcredit recipients, IP registrations, internet access, Getting Credit / Protecting Investors rank (WB), mobile money, financial literacy, entrepreneurship rate</td>
                      </tr>
                      <tr>
                        <td className="py-2">Peace &amp; Security</td>
                        <td className="py-2 font-semibold">10%</td>
                        <td className="py-2">Internally displaced youth, trafficking victims, deaths from violent extremism (ages 18–35)</td>
                      </tr>
                      <tr>
                        <td className="py-2">Access to Justice</td>
                        <td className="py-2 font-semibold">10%</td>
                        <td className="py-2">Youth awaiting trial, youth imprisoned, juvenile detentions</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="text-foreground font-semibold mt-4">Calculation Method</h4>
                <Content
                  as="ol"
                  id="methodology.ayi.calculation"
                  fallback={
                    <>
                      <li>Normalize all indicators to 0-100 scale using min-max normalization</li>
                      <li>Calculate dimension scores as weighted average of constituent indicators</li>
                      <li>Compute overall AYI as weighted sum of dimension scores</li>
                      <li>Rank countries from highest to lowest AYI score</li>
                    </>
                  }
                  className="space-y-1"
                />
              </CardContent>
            </Card>

            {/* Updates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  <Content as="span" id="methodology.updates.title" fallback="Data Updates & Version Control" />
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <Content
                  as="div"
                  id="methodology.updates.body"
                  fallback={
                    <>
                      <p>We maintain a systematic approach to data updates and version control:</p>
                      <ul className="space-y-2">
                        <li><strong>Annual Updates:</strong> Core indicators are reviewed and updated annually when new source data is released</li>
                        <li><strong>Continuous Monitoring:</strong> We track major data releases from key sources and integrate promptly</li>
                        <li><strong>Version History:</strong> All datasets maintain version history showing changes over time</li>
                        <li><strong>Changelog:</strong> Material changes to methodology are documented and communicated to users</li>
                        <li><strong>API Versioning:</strong> Premium API users have access to version-specific endpoints for reproducibility</li>
                      </ul>
                    </>
                  }
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Methodology;
