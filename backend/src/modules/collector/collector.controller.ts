import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { CollectorService } from './collector.service.js';
import { WechatTokenService } from './services/wechat-token.service.js';
import { WechatCollector } from './collectors/wechat.collector.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';

class SyncDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceIds?: string[];
}

class UpdateWechatCredentialsDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  cookie: string;
}

class ValidateWechatDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsOptional()
  @IsString()
  name?: string;
}

@Controller('api')
export class CollectorController {
  private readonly logger = new Logger(CollectorController.name);

  constructor(
    private readonly collectorService: CollectorService,
    private readonly wechatTokenService: WechatTokenService,
    private readonly wechatCollector: WechatCollector,
  ) {}

  /**
   * 手动触发采集（调试用）
   * POST /api/system/sync
   */
  @Post('system/sync')
  async sync(@Body() dto: SyncDto) {
    try {
      if (!dto.userId) throw new BadRequestException('userId is required');
      this.logger.log(`手动触发采集: userId=${dto.userId}`);

      let results;
      if (dto.sourceIds && dto.sourceIds.length > 0) {
        results = await this.collectorService.collectBySources(dto.sourceIds);
      } else {
        results = await this.collectorService.collectByUser(dto.userId);
      }

      return ApiResponse.ok(results, '采集完成');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`采集失败: ${msg}`);
      throw new HttpException(
        ApiResponse.fail(`采集失败: ${msg}`),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 更新微信凭证（前端传递 Token/Cookie）
   * POST /api/wechat/credentials
   */
  @Post('wechat/credentials')
  async updateWechatCredentials(@Body() dto: UpdateWechatCredentialsDto) {
    if (!dto.token || !dto.cookie) {
      throw new HttpException(
        ApiResponse.fail('token 和 cookie 不能为空'),
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const creds = await this.wechatTokenService.updateCredentials(
        dto.token,
        dto.cookie,
      );
      return ApiResponse.ok(
        {
          source: creds.source,
          updatedAt: creds.updatedAt,
          expiresAt: creds.expiresAt,
        },
        '微信凭证更新成功',
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        ApiResponse.fail(`凭证更新失败: ${msg}`),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取微信凭证状态
   * GET /api/wechat/credentials/status
   */
  @Get('wechat/credentials/status')
  async getWechatCredentialsStatus() {
    const status = await this.wechatTokenService.getStatus();
    return ApiResponse.ok(status);
  }

  /**
   * 搜索微信公众号（通过名称查找 fakeid）
   * GET /api/wechat/search?query=xxx
   */
  @Get('wechat/search')
  async searchWechatAccount(@Query('query') query: string) {
    if (!query || query.trim().length === 0) {
      throw new HttpException(
        ApiResponse.fail('搜索关键词不能为空'),
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const accounts = await this.wechatCollector.searchAccount(query.trim());
      return ApiResponse.ok(accounts);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('凭证不可用') || msg.includes('Token 已过期')) {
        throw new HttpException(
          ApiResponse.fail(`搜索失败: ${msg}。请先更新微信凭证`),
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new HttpException(
        ApiResponse.fail(`搜索失败: ${msg}`),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 验证公众号 fakeid
   * POST /api/wechat/validate
   */
  @Post('wechat/validate')
  async validateWechatSource(@Body() body: ValidateWechatDto) {
    if (!body.identifier) {
      throw new HttpException(
        ApiResponse.fail('identifier 不能为空'),
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.wechatCollector.validateSource(body);
    return ApiResponse.ok(result);
  }
}
