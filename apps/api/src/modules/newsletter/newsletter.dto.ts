import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: false, example: 'landing-hero' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'May 2026 Youth Briefing' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: 'African youth data — what moved in May 2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  subject!: string;

  @ApiProperty({ description: 'Inner HTML body — wrapped in the branded layout on send.' })
  @IsString()
  @MinLength(1)
  bodyHtml!: string;
}

export class UpdateCampaignDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  subject?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  bodyHtml?: string;
}

export class TestEmailDto {
  @ApiProperty({ example: 'admin@africanyouthobservatory.org' })
  @IsEmail()
  email!: string;
}
