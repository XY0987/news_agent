import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSourceDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsEnum([
    'wechat',
    'github',
    'rss',
    'twitter',
    'youtube',
    'hackernews',
    'reddit',
  ])
  type: string;

  @IsNotEmpty()
  @IsString()
  identifier: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  config?: Record<string, any>;
}

export class UpdateSourceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  config?: Record<string, any>;

  @IsOptional()
  @IsEnum(['active', 'paused', 'removed'])
  status?: string;
}

export class ValidateSourceDto {
  @IsNotEmpty()
  @IsEnum([
    'wechat',
    'github',
    'rss',
    'twitter',
    'youtube',
    'hackernews',
    'reddit',
  ])
  type: string;

  @IsNotEmpty()
  @IsString()
  identifier: string;
}
