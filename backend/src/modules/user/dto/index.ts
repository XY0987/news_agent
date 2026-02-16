import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsObject()
  profile?: Record<string, any>;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @IsOptional()
  @IsObject()
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
  @IsString()
  role?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsNumber()
  experienceYears?: number;

  @IsOptional()
  @IsString()
  companyType?: string;

  @IsOptional()
  @IsObject()
  interests?: {
    primary?: string[];
    secondary?: string[];
    excluded?: string[];
  };

  @IsOptional()
  @IsObject()
  contentPreferences?: {
    depth?: string;
    formats?: string[];
    languages?: string[];
    freshness?: string;
  };
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  pushFrequency?: string;

  @IsOptional()
  @IsString()
  pushTime?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pushChannels?: string[];

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsObject()
  scoreWeights?: {
    relevance?: number;
    quality?: number;
    timeliness?: number;
    novelty?: number;
    actionability?: number;
  };

  @IsOptional()
  @IsNumber()
  topN?: number;
}

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsString()
  emailAddress?: string;

  @IsOptional()
  @IsObject()
  channels?: Record<string, any>;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  // 允许任意额外字段通过（兼容灵活的 settings 结构）
  [key: string]: any;
}
