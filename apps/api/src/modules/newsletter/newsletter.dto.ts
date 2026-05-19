import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NewsletterAudience } from '@prisma/client';

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

/** One downloadable resource linked at the bottom of a campaign email. */
export class AttachmentDto {
  @ApiProperty({ example: 'African Youth Index 2026 (PDF)' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ example: 'https://pub-xxx.r2.dev/reports/ayi-2026.pdf' })
  @IsString()
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ required: false, example: '4.2 MB · PDF' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  sizeHint?: string;
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

  @ApiProperty({ enum: ['SUBSCRIBERS', 'USERS', 'BOTH'], required: false, default: 'SUBSCRIBERS' })
  @IsOptional()
  @IsEnum(NewsletterAudience)
  audience?: NewsletterAudience;

  @ApiProperty({ required: false, type: [AttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
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

  @ApiProperty({ enum: ['SUBSCRIBERS', 'USERS', 'BOTH'], required: false })
  @IsOptional()
  @IsEnum(NewsletterAudience)
  audience?: NewsletterAudience;

  @ApiProperty({ required: false, type: [AttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class TestEmailDto {
  @ApiProperty({ example: 'admin@africanyouthobservatory.org' })
  @IsEmail()
  email!: string;
}

export class ListSubscribersDto {
  @ApiProperty({ required: false, example: 'gmail.com' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiProperty({ enum: ['SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED'], required: false })
  @IsOptional()
  @IsEnum(['SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED'])
  status?: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'BOUNCED';

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 50, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}
