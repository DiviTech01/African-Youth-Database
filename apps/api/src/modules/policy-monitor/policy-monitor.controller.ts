import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PolicyMonitorService } from './policy-monitor.service';
import { PolicyRankingsDto, PolicyComputeDto } from './policy-monitor.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('policy-monitor')
@Controller('policy-monitor')
export class PolicyMonitorController {
  constructor(private readonly policyMonitorService: PolicyMonitorService) {}

  @Get('rankings')
  @Public()
  @ApiOperation({
    summary: 'Get policy compliance rankings',
    description:
      'Returns all countries ranked by their AYC compliance score, with component breakdowns and tier assignments.',
  })
  getRankings(@Query() dto: PolicyRankingsDto) {
    return this.policyMonitorService.getRankings(dto);
  }

  @Get('summary')
  @Public()
  @ApiOperation({
    summary: 'Get continental policy compliance summary',
    description:
      'Returns aggregate statistics: AYC ratification rates, WPAY compliance, regional breakdowns, and recent ratifications.',
  })
  getSummary() {
    return this.policyMonitorService.getSummary();
  }

  @Get(':countryId')
  @Public()
  @ApiOperation({
    summary: 'Get detailed compliance info for a country',
    description:
      'Returns policy details, compliance score with 7-component breakdown, tier, and recommendations.',
  })
  getCountryDetail(@Param('countryId') countryId: string) {
    return this.policyMonitorService.getCountryDetail(countryId);
  }

  @Post('compute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Compute and persist compliance scores',
    description:
      'Runs the compliance scorer for one or all countries and saves the overallScore to the database. Admin only.',
  })
  computeCompliance(@Body() dto: PolicyComputeDto) {
    return this.policyMonitorService.computeCompliance(dto.countryId);
  }
}
