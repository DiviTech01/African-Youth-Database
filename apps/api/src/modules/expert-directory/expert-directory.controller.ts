import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpertDirectoryService } from './expert-directory.service';
import { ExpertSearchDto, CreateExpertDto, UpdateExpertDto } from './expert-directory.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('experts')
@Controller('experts')
export class ExpertDirectoryController {
  constructor(private readonly expertService: ExpertDirectoryService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Search and list experts',
    description:
      'Returns paginated expert list with optional filtering by name, country, region, specialization, language, and verification status.',
  })
  search(@Query() dto: ExpertSearchDto) {
    return this.expertService.search(dto);
  }

  @Get('stats')
  @Public()
  @ApiOperation({
    summary: 'Get expert directory statistics',
    description:
      'Returns aggregate stats: total experts, regional distribution, top specializations, top languages.',
  })
  getStats() {
    return this.expertService.getStats();
  }

  @Get('specializations')
  @Public()
  @ApiOperation({
    summary: 'Get list of predefined specializations',
    description: 'Returns the full list of recognized specialization categories for expert registration.',
  })
  getSpecializations() {
    const { SPECIALIZATIONS } = require('./expert-directory.service');
    return { specializations: SPECIALIZATIONS };
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get expert by ID',
    description: 'Returns full expert profile including country, specializations, and bio.',
  })
  getById(@Param('id') id: string) {
    return this.expertService.getById(id);
  }

  @Post()
  @Public()
  @ApiOperation({
    summary: 'Register as an expert',
    description:
      'Submit expert registration. New registrations start as unverified and require admin approval.',
  })
  create(@Body() dto: CreateExpertDto) {
    return this.expertService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an expert profile (admin)',
    description: 'Admin can update any expert field including verification status.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateExpertDto) {
    return this.expertService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete an expert (admin)',
    description: 'Permanently removes an expert from the directory.',
  })
  delete(@Param('id') id: string) {
    return this.expertService.delete(id);
  }
}
