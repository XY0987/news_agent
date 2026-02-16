import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  profile?: Record<string, any>;

  @IsOptional()
  preferences?: Record<string, any>;

  @IsOptional()
  notificationSettings?: Record<string, any>;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  role?: string;

  @IsOptional()
  techStack?: string[];

  @IsOptional()
  experienceYears?: number;

  @IsOptional()
  companyType?: string;

  @IsOptional()
  interests?: {
    primary?: string[];
    secondary?: string[];
    excluded?: string[];
  };

  @IsOptional()
  contentPreferences?: {
    depth?: string;
    formats?: string[];
    languages?: string[];
    freshness?: string;
  };
}

export class UpdatePreferencesDto {
  @IsOptional()
  pushFrequency?: string;

  @IsOptional()
  pushTime?: string;

  @IsOptional()
  pushChannels?: string[];

  @IsOptional()
  quietHoursStart?: string;

  @IsOptional()
  quietHoursEnd?: string;

  @IsOptional()
  scoreWeights?: {
    relevance?: number;
    quality?: number;
    timeliness?: number;
    novelty?: number;
    actionability?: number;
  };

  @IsOptional()
  topN?: number;
}
