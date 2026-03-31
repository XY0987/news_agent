import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  Matches,
} from 'class-validator';
import { SkillService } from './skill.service.js';
import { SkillExecutorService } from './skill-executor.service.js';
import { SkillGitService } from './skill-git.service.js';
import { AgentService } from '../agent/agent.service.js';

// ==================== DTO ====================

class RunSkillDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

class EnableSkillDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

class DisableSkillDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsObject()
  @IsNotEmpty()
  settings: Record<string, any>;
}

class InstallSkillDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^https:\/\//, { message: 'gitUrl 必须以 https:// 开头' })
  gitUrl: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  directory?: string;
}

/**
 * Skill 管理接口
 *
 * - GET    /api/skills                 获取 Skill 列表
 * - GET    /api/skills/stats           获取注册表统计
 * - GET    /api/skills/:skillId        获取 Skill 详情
 * - POST   /api/skills/:skillId/run    手动执行 Skill
 * - POST   /api/skills/:skillId/enable  启用 Skill
 * - POST   /api/skills/:skillId/disable 禁用 Skill
 * - PUT    /api/skills/:skillId/settings 更新 Skill 配置
 * - POST   /api/skills/reload          热重载 Skill（管理员）
 * - POST   /api/skills/install         从 Git 仓库安装 Skill
 * - DELETE /api/skills/:skillId/uninstall 卸载 Git Skill
 * - POST   /api/skills/:skillId/update  更新 Git Skill
 * - GET    /api/skills/executions      获取执行记录
 * - GET    /api/skills/executions/:id  获取执行详情
 */
@Controller('api/skills')
export class SkillController {
  private readonly logger = new Logger(SkillController.name);

  constructor(
    private readonly skillService: SkillService,
    private readonly executor: SkillExecutorService,
    private readonly agentService: AgentService,
    private readonly gitService: SkillGitService,
  ) {}

  // ==================== 列表与详情 ====================

  /**
   * GET /api/skills
   * 获取用户可见的所有 Skill 列表
   */
  @Get()
  async listSkills(@Query('userId') userId: string) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    const skills = await this.skillService.listSkills(userId);

    return {
      success: true,
      data: skills,
      total: skills.length,
    };
  }

  /**
   * GET /api/skills/stats
   * 获取注册表统计信息
   */
  @Get('stats')
  getStats() {
    const stats = this.skillService.getRegistryStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /api/skills/executions
   * 获取 Skill 执行历史
   */
  @Get('executions')
  async getExecutions(
    @Query('userId') userId: string,
    @Query('skillId') skillId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    const executions = await this.skillService.getExecutionHistory(
      userId,
      skillId,
      limit ? parseInt(limit, 10) : 20,
    );

    return {
      success: true,
      data: executions,
      total: executions.length,
    };
  }

  /**
   * GET /api/skills/executions/:id
   * 获取单次执行详情
   */
  @Get('executions/:id')
  async getExecutionDetail(@Param('id') id: string) {
    const execution = await this.skillService.getExecutionDetail(id);
    if (!execution) {
      throw new HttpException('Execution not found', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      data: execution,
    };
  }

  /**
   * GET /api/skills/:skillId
   * 获取 Skill 详情（注册信息 + 用户配置 + 最近执行）
   */
  @Get(':skillId')
  async getSkillDetail(
    @Param('skillId') skillId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    const detail = await this.skillService.getSkillDetail(skillId, userId);
    if (!detail) {
      throw new HttpException(
        `Skill "${skillId}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      data: detail,
    };
  }

  // ==================== Skill 配置管理 ====================

  /**
   * POST /api/skills/:skillId/enable
   * 启用 Skill
   */
  @Post(':skillId/enable')
  async enableSkill(
    @Param('skillId') skillId: string,
    @Body() body: EnableSkillDto,
  ) {
    try {
      const config = await this.skillService.enableSkill(
        body.userId,
        skillId,
        body.settings,
      );

      return {
        success: true,
        data: {
          skillId,
          status: config.status,
          settings: config.settings,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `启用 Skill 失败: ${(error as Error).message}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /api/skills/:skillId/disable
   * 禁用 Skill
   */
  @Post(':skillId/disable')
  async disableSkill(
    @Param('skillId') skillId: string,
    @Body() body: DisableSkillDto,
  ) {
    try {
      const config = await this.skillService.disableSkill(body.userId, skillId);

      return {
        success: true,
        data: {
          skillId,
          status: config?.status || 'disabled',
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `禁用 Skill 失败: ${(error as Error).message}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PUT /api/skills/:skillId/settings
   * 更新 Skill 用户配置
   */
  @Put(':skillId/settings')
  async updateSettings(
    @Param('skillId') skillId: string,
    @Body() body: UpdateSettingsDto,
  ) {
    try {
      const config = await this.skillService.updateSettings(
        body.userId,
        skillId,
        body.settings,
      );

      return {
        success: true,
        data: {
          skillId,
          settings: config.settings,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `更新配置失败: ${(error as Error).message}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ==================== Skill 执行 ====================

  /**
   * POST /api/skills/:skillId/run
   * 手动触发 Skill 执行
   *
   * 完整流程：prepareExecution → executeLifecycle（pre_run + buildConfig）
   *          → AgentService.runSkill（Agent Loop）→ executePostRun
   *          → markExecutionSuccess / markExecutionFailed
   */
  @Post(':skillId/run')
  async runSkill(@Param('skillId') skillId: string, @Body() body: RunSkillDto) {
    this.logger.log(`手动触发 Skill 执行: ${skillId}, userId=${body.userId}`);

    let executionId: string | undefined;

    try {
      // 1. 准备执行（构建上下文 + 创建 execution 记录）
      const prepared = await this.skillService.prepareExecution({
        skillId,
        userId: body.userId,
        inputParams: body.params,
      });
      const { context } = prepared;
      executionId = prepared.executionId;

      // 2. 执行生命周期（pre_run 钩子 + buildConfig）
      const { config, preRunOutput } =
        await this.executor.executeLifecycle(context);

      this.logger.log(
        `Skill ${skillId} 配置构建完成: ${config.tools.length} tools, prompt ${config.systemPrompt.length} chars`,
      );

      // 3. 调用 AgentService.runSkill() 执行 Agent Loop
      const agentResult = await this.agentService.runSkill(config);

      // 4. 执行 post_run 钩子（失败仅警告，不影响结果）
      try {
        await this.executor.executePostRun(context, agentResult);
      } catch (postRunError) {
        this.logger.warn(
          `Skill ${skillId} post_run 钩子异常: ${(postRunError as Error).message}`,
        );
      }

      // 5. 更新执行记录
      if (agentResult.isSuccess) {
        await this.skillService.markExecutionSuccess(executionId, {
          stepsCount: agentResult.stepsUsed,
          durationMs: agentResult.totalDurationMs,
          outputData: {
            report: agentResult.report,
            digestSent: agentResult.digestSent,
            contentCount: agentResult.contentCount,
            isFallback: agentResult.isFallback,
            preRunOutput: preRunOutput || undefined,
          },
        });
      } else {
        await this.skillService.markExecutionFailed(executionId, {
          errorMessage: agentResult.report,
          durationMs: agentResult.totalDurationMs,
          stepsCount: agentResult.stepsUsed,
        });
      }

      return {
        success: true,
        data: {
          executionId,
          sessionId: agentResult.sessionId,
          skillId,
          status: agentResult.isSuccess ? 'success' : 'failed',
          report: agentResult.report,
          stepsUsed: agentResult.stepsUsed,
          durationMs: agentResult.totalDurationMs,
          digestSent: agentResult.digestSent,
          contentCount: agentResult.contentCount,
          isFallback: agentResult.isFallback,
          message: agentResult.isSuccess
            ? 'Skill 执行成功'
            : 'Skill 执行完成但未完全成功',
        },
      };
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`Skill ${skillId} 执行失败: ${errMsg}`);

      // 清理可能已注册的动态脚本工具
      try {
        this.executor.cleanupSkillScriptTools(skillId);
      } catch {
        // 忽略清理错误
      }

      // 如果已有 executionId，更新为失败
      if (executionId) {
        try {
          await this.skillService.markExecutionFailed(executionId, {
            errorMessage: errMsg,
            durationMs: 0,
          });
        } catch (markError) {
          this.logger.error(
            `更新执行记录失败: ${(markError as Error).message}`,
          );
        }
      }

      throw new HttpException(
        {
          success: false,
          message: `Skill 执行失败: ${errMsg}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== 管理操作 ====================

  /**
   * POST /api/skills/reload
   * 热重载 Skill（可指定 skillId 或全部重载）
   */
  @Post('reload')
  async reloadSkills(@Body() body: { skillId?: string }) {
    try {
      const count = await this.skillService.reloadSkills(body.skillId);
      return {
        success: true,
        data: {
          reloadedCount: count,
          skillId: body.skillId || 'all',
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `重载失败: ${(error as Error).message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== Git Skill 安装管理 ====================

  /**
   * POST /api/skills/install
   * 从 Git 仓库安装 Skill
   *
   * 用户提供 gitUrl、branch（可选，默认 main）、directory（可选，仓库内子目录）
   * 系统自动 clone 到 skills/ 目录，解析并注册
   */
  @Post('install')
  async installSkill(@Body() body: InstallSkillDto) {
    this.logger.log(
      `安装 Skill: ${body.gitUrl} (branch=${body.branch || 'main'}, dir=${body.directory || '/'})`,
    );

    try {
      const result = await this.gitService.install({
        gitUrl: body.gitUrl,
        branch: body.branch,
        directory: body.directory,
      });

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: {
          skillId: result.skillId,
          skillName: result.skillName,
          installedPath: result.installedPath,
        },
        message: result.message,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: `安装失败: ${(error as Error).message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /api/skills/:skillId/uninstall
   * 卸载通过 Git 安装的 Skill
   */
  @Delete(':skillId/uninstall')
  async uninstallSkill(@Param('skillId') skillId: string) {
    this.logger.log(`卸载 Skill: ${skillId}`);

    try {
      const result = await this.gitService.uninstall(skillId);

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: `卸载失败: ${(error as Error).message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/skills/:skillId/update
   * 更新通过 Git 安装的 Skill（重新 clone）
   */
  @Post(':skillId/update')
  async updateSkill(@Param('skillId') skillId: string) {
    this.logger.log(`更新 Skill: ${skillId}`);

    try {
      const result = await this.gitService.update(skillId);

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: {
          skillId: result.skillId,
          skillName: result.skillName,
        },
        message: result.message,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: `更新失败: ${(error as Error).message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/skills/:skillId/source
   * 获取 Skill 的 Git 来源信息
   */
  @Get(':skillId/source')
  getSkillSource(@Param('skillId') skillId: string) {
    const source = this.gitService.getSourceInfo(skillId);
    return {
      success: true,
      data: source,
    };
  }
}
