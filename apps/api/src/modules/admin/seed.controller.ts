import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// ADMIN-only. These endpoints write directly to the production DB (including
// creating an ADMIN user), so they must never be publicly reachable.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('seed')
export class SeedController {
  constructor(private prisma: PrismaService) {}

  @Post('users')
  async seedUsers() {
    // Supabase owns authentication; these rows exist only to attach roles.
    const users = [
      { id: 'seed-admin-001', email: 'admin@africanyouthobservatory.org', name: 'AYO Admin', role: 'ADMIN' },
      { id: 'seed-contributor-001', email: 'data@africanyouthobservatory.org', name: 'Data Team', role: 'CONTRIBUTOR' },
      { id: 'seed-researcher-001', email: 'researcher@africanyouthobservatory.org', name: 'Test Researcher', role: 'RESEARCHER' },
      { id: 'seed-demo-001', email: 'demo@africanyouthobservatory.org', name: 'Demo User', role: 'REGISTERED' },
    ];

    const results = [];
    for (const u of users) {
      const user = await this.prisma.user.upsert({
        where: { email: u.email },
        update: { role: u.role as any },
        create: { id: u.id, email: u.email, name: u.name, role: u.role as any },
      });
      results.push({ email: user.email, role: user.role, status: 'ok' });
    }
    return { seeded: results.length, users: results };
  }

  @Post('sample-data')
  async seedSampleData() {
    const countries = await this.prisma.country.findMany();
    const indicators = await this.prisma.indicator.findMany();

    if (!countries.length || !indicators.length) {
      return { error: 'No countries or indicators found. Seed those first.' };
    }

    let inserted = 0;
    const years = [2018, 2019, 2020, 2021, 2022, 2023];

    for (const country of countries) {
      const batch = [];
      for (const indicator of indicators) {
        for (const year of years) {
          let value: number;
          switch (indicator.unit) {
            case 'PERCENTAGE': value = Math.round((20 + Math.random() * 60) * 100) / 100; break;
            case 'INDEX': value = Math.round((30 + Math.random() * 70) * 100) / 100; break;
            case 'RATE': value = Math.round((5 + Math.random() * 50) * 100) / 100; break;
            case 'YEARS': value = Math.round((45 + Math.random() * 30) * 100) / 100; break;
            case 'CURRENCY': value = Math.round(500 + Math.random() * 5000); break;
            default: value = Math.round(Math.random() * 100 * 100) / 100;
          }
          batch.push({
            countryId: country.id,
            indicatorId: indicator.id,
            year,
            value,
            gender: 'TOTAL' as any,
            ageGroup: '15-35',
            source: 'Sample Data',
            confidence: 0.7,
            isEstimate: true,
          });
        }
      }
      try {
        const result = await this.prisma.indicatorValue.createMany({
          data: batch,
          skipDuplicates: true,
        });
        inserted += result.count;
      } catch (e) {
        // Skip errors for individual countries
      }
    }
    return { inserted, countries: countries.length, indicators: indicators.length, years: years.length };
  }

  @Post('policies')
  async seedPolicies() {
    const countries = await this.prisma.country.findMany();
    let seeded = 0;

    for (const country of countries) {
      try {
        await this.prisma.countryPolicy.upsert({
          where: { id: `policy-${country.id}` },
          update: {},
          create: {
            id: `policy-${country.id}`,
            countryId: country.id,
            policyName: `${country.name} National Youth Policy`,
            policyType: 'NATIONAL_YOUTH_POLICY',
            yearAdopted: 2010 + Math.floor(Math.random() * 13),
            aycRatified: Math.random() > 0.3,
            aycRatifiedYear: Math.random() > 0.3 ? 2005 + Math.floor(Math.random() * 15) : null,
            wpayCompliant: Math.random() > 0.4,
            complianceScore: Math.round((30 + Math.random() * 60) * 10) / 10,
            status: 'active',
          },
        });
        seeded++;
      } catch (e) {}
    }
    return { seeded };
  }

  @Post('experts')
  async seedExperts() {
    const countries = await this.prisma.country.findMany({ take: 28 });
    const specializations = ['Education', 'Employment', 'Health', 'Governance', 'Technology', 'Gender', 'Agriculture', 'Finance'];
    const titles = ['Research Fellow', 'Senior Analyst', 'Policy Advisor', 'Program Manager', 'Director', 'Professor', 'Consultant'];
    let seeded = 0;

    for (let i = 0; i < Math.min(28, countries.length); i++) {
      const country = countries[i];
      const spec = specializations[i % specializations.length];
      const title = titles[i % titles.length];
      try {
        await this.prisma.expert.upsert({
          where: { email: `expert${i + 1}@ayd-research.org` },
          update: {},
          create: {
            name: `Dr. Expert ${i + 1}`,
            email: `expert${i + 1}@ayd-research.org`,
            title: `${title} - ${spec}`,
            organization: `${country.name} Youth Research Institute`,
            countryId: country.id,
            specializations: [spec, specializations[(i + 1) % specializations.length]],
            languages: ['English', i % 3 === 0 ? 'French' : i % 3 === 1 ? 'Arabic' : 'Portuguese'],
            bio: `Expert in ${spec.toLowerCase()} policy and youth development in ${country.name}.`,
            verified: true,
          },
        });
        seeded++;
      } catch (e) {}
    }
    return { seeded };
  }

  @Post('all')
  async seedAll() {
    const users = await this.seedUsers();
    const policies = await this.seedPolicies();
    const experts = await this.seedExperts();
    const data = await this.seedSampleData();
    return { users, policies, experts, data };
  }
}
