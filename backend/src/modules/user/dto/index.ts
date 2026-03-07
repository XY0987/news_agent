import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsObject,
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
  @IsArray()
  @IsString({ each: true })
  primaryInterests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryInterests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeTags?: string[];

  @IsOptional()
  @IsString()
  contentDepth?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentFormats?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  notifyTime?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyChannels?: string[];

  @IsOptional()
  @IsNumber()
  topN?: number;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsString()
  pushFrequency?: string;

  @IsOptional()
  @IsObject()
  scoreWeights?: {
    relevance?: number;
    quality?: number;
    timeliness?: number;
    novelty?: number;
    actionability?: number;
  };
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
