import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AgentService } from './agent.service';

class RunAgentDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

class RunAnalysisDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  daysWindow?: number;
}

/**
 * Agent 交互接口
 * - POST /api/agent/run          手动触发 Agent 执行（调试用）
 * - GET  /api/agent/logs          查询 Agent 执行日志
 * - GET  /api/agent/logs/:sessionId  查询单次执行的完整步骤
 * - GET  /api/agent/sessions      查询最近的执行会话列表
 */
@Controller('api/agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private readonly agentService: AgentService) {}

  /**
   * POST /api/agent/run
   * 手动触发 Agent 执行每日推送任务
   */
  @Post('run')
  async runAgent(@Body() body: RunAgentDto) {
    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`手动触发 Agent 执行: userId=${body.userId}`);

    try {
      const result = await this.agentService.runDailyDigest(body.userId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Agent 执行失败: ${(error as Error).message}`);
      throw new HttpException(
        {
          success: false,
          message: `Agent 执行失败: ${(error as Error).message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/agent/analyze
   * 仅执行 AI 分析（跳过采集），对已有文章进行评分+摘要+推送
   */
  @Post('analyze')
  async runAnalysis(@Body() body: RunAnalysisDto) {
    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`手动触发 AI 分析: userId=${body.userId}, daysWindow=${body.daysWindow || 1}`);

    try {
      const result = await this.agentService.runAnalysisOnly(body.userId, {
        daysWindow: body.daysWindow || 1,
      });
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`AI 分析失败: ${(error as Error).message}`);
      throw new HttpException(
        {
          success: false,
          message: `AI 分析失败: ${(error as Error).message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/agent/logs
   * 查询 Agent 执行日志列表
   */
  @Get('logs')
  async getLogs(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    const logs = await this.agentService.getExecutionLogs(
      userId,
      limit ? parseInt(limit, 10) : 20,
    );

    return {
      success: true,
      data: logs,
      total: logs.length,
    };
  }

  /**
   * GET /api/agent/logs/:sessionId
   * 查询单次执行的完整步骤
   */
  @Get('logs/:sessionId')
  async getSessionLogs(@Param('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new HttpException(
        'sessionId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const logs = await this.agentService.getSessionLogs(sessionId);

    return {
      success: true,
      data: logs,
      total: logs.length,
    };
  }

  /**
   * GET /api/agent/sessions
   * 查询最近的执行会话列表
   */
  @Get('sessions')
  async getSessions(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    const sessions = await this.agentService.getRecentSessions(
      userId,
      limit ? parseInt(limit, 10) : 10,
    );

    return {
      success: true,
      data: sessions,
      total: sessions.length,
    };
  }
}
