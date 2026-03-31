import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillConfigEntity } from '../../common/database/entities/skill-config.entity.js';
import { SkillExecutionEntity } from '../../common/database/entities/skill-execution.entity.js';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillExecutorService } from './skill-executor.service.js';
import { UserService } from '../user/user.service.js';
import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillRegistryEntry,
} from './skill.types.js';

/**
 * Skill 业务服务
 *
 * 负责：
 * 1. Skill 列表查询（注册表 + 用户配置合并）
 * 2. Skill 启用/禁用（写入 skill_configs 表）
 * 3. Skill 用户配置更新
 * 4. Skill 执行记录管理
 * 5. 作为 AgentService.runSkill() 的前置编排层
 */
@Injectable()
export class SkillService {
  private readonly logger = new Logger(SkillService.name);

  constructor(
    @InjectRepository(SkillConfigEntity)
    private readonly configRepo: Repository<SkillConfigEntity>,
    @InjectRepository(SkillExecutionEntity)
    private readonly executionRepo: Repository<SkillExecutionEntity>,
    private readonly registry: SkillRegistryService,
    private readonly executor: SkillExecutorService,
    private readonly userService: UserService,
  ) {}

  // ==================== Skill 列表与详情 ====================

  /**
   * 获取用户可见的所有 Skill 列表
   *
   * 合并注册表信息 + 用户配置状态
   * 标准格式下 frontmatter 只有 name + description
   */
  async listSkills(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      status: 'enabled' | 'disabled' | 'not_configured';
      settings?: Record<string, any>;
    }>
  > {
    // 从注册表获取所有可用 Skill
    const entries = this.registry.list({
      isAvailable: true,
    });

    // 批量获取用户配置
    const configs = await this.configRepo.find({
      where: { userId },
    });
    const configMap = new Map(configs.map((c) => [c.skillId, c]));

    return entries.map((entry) => {
      const skill = entry.skill;
      const config = configMap.get(skill.id);

      return {
        id: skill.id,
        name: skill.frontmatter.name,
        description: skill.frontmatter.description,
        status: config ? config.status : ('not_configured' as const),
        settings: config?.settings,
      };
    });
  }

  /**
   * 获取 Skill 详情（注册表信息 + 用户配置 + 最近执行）
   *
   * 标准格式下，frontmatter 只有 name + description，
   * 详细的工具/步骤/配置信息都在 prompt（Markdown 正文）中
   */
  async getSkillDetail(
    skillId: string,
    userId: string,
  ): Promise<{
    id: string;
    name: string;
    description: string;
    references: string[];
    scripts: string[];
    userConfig: {
      status: 'enabled' | 'disabled' | 'not_configured';
      settings: Record<string, any>;
    };
    recentExecutions: any[];
  } | null> {
    const entry = this.registry.get(skillId);
    if (!entry) return null;

    const skill = entry.skill;

    // 获取用户配置
    const config = await this.configRepo.findOne({
      where: { userId, skillId },
    });

    // 获取最近执行记录
    const executions = await this.executionRepo.find({
      where: { userId, skillId },
      order: { startedAt: 'DESC' },
      take: 10,
    });

    return {
      id: skill.id,
      name: skill.frontmatter.name,
      description: skill.frontmatter.description,
      references: skill.references,
      scripts: skill.scripts,
      userConfig: {
        status: config ? config.status : 'not_configured',
        settings: config?.settings || {},
      },
      recentExecutions: executions.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        status: e.status,
        stepsCount: e.stepsCount,
        durationMs: e.durationMs,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        errorMessage: e.errorMessage,
      })),
    };
  }

  // ==================== Skill 配置管理 ====================

  /**
   * 启用 Skill
   */
  async enableSkill(
    userId: string,
    skillId: string,
    settings?: Record<string, any>,
  ): Promise<SkillConfigEntity> {
    // 确认 Skill 存在
    this.registry.getOrThrow(skillId);

    let config = await this.configRepo.findOne({
      where: { userId, skillId },
    });

    if (config) {
      config.status = 'enabled';
      if (settings) {
        config.settings = { ...(config.settings || {}), ...settings };
      }
    } else {
      config = this.configRepo.create({
        userId,
        skillId,
        status: 'enabled',
        settings: settings || {},
      });
    }

    const saved = await this.configRepo.save(config);
    this.logger.log(`用户 ${userId} 启用 Skill: ${skillId}`);
    return saved;
  }

  /**
   * 禁用 Skill
   */
  async disableSkill(
    userId: string,
    skillId: string,
  ): Promise<SkillConfigEntity | null> {
    const config = await this.configRepo.findOne({
      where: { userId, skillId },
    });

    if (!config) {
      // 不存在配置 → 创建一个 disabled 的
      const newConfig = this.configRepo.create({
        userId,
        skillId,
        status: 'disabled',
        settings: {},
      });
      return this.configRepo.save(newConfig);
    }

    config.status = 'disabled';
    const saved = await this.configRepo.save(config);
    this.logger.log(`用户 ${userId} 禁用 Skill: ${skillId}`);
    return saved;
  }

  /**
   * 更新 Skill 用户配置
   */
  async updateSettings(
    userId: string,
    skillId: string,
    settings: Record<string, any>,
  ): Promise<SkillConfigEntity> {
    let config = await this.configRepo.findOne({
      where: { userId, skillId },
    });

    if (!config) {
      config = this.configRepo.create({
        userId,
        skillId,
        status: 'enabled',
        settings,
      });
    } else {
      config.settings = { ...(config.settings || {}), ...settings };
    }

    return this.configRepo.save(config);
  }

  // ==================== Skill 执行 ====================

  /**
   * 准备 Skill 执行（构建上下文 + 记录执行开始）
   *
   * 返回 SkillExecutionContext 和 executionId，供 AgentService.runSkill() 使用
   */
  async prepareExecution(params: {
    skillId: string;
    userId: string;
    inputParams?: Record<string, any>;
  }): Promise<{
    context: SkillExecutionContext;
    executionId: string;
  }> {
    const { skillId, userId, inputParams } = params;

    // 确认 Skill 已注册且用户已启用
    this.registry.getOrThrow(skillId);
    const config = await this.configRepo.findOne({
      where: { userId, skillId },
    });

    // 获取用户信息以填充 Prompt 变量
    const user = await this.userService.findById(userId);

    // 用户自定义 settings（从 skill_configs 表获取）
    const userSettings = config?.settings || {};

    // 构建执行上下文
    const context = this.executor.createContext({
      skillId,
      userId,
      inputParams: {
        userName: user.name,
        userInterests: user.profile?.interests?.join(', ') || '未设置',
        ...userSettings,
        ...(inputParams || {}),
      },
      userSettings,
    });

    // 创建执行记录
    const execution = this.executionRepo.create({
      skillId,
      userId,
      sessionId: context.sessionId,
      status: 'running',
      inputParams: inputParams || {},
      startedAt: new Date(),
    });
    const saved = await this.executionRepo.save(execution);

    this.logger.log(
      `Skill 执行准备完成: ${skillId} (session=${context.sessionId}, execution=${saved.id})`,
    );

    return {
      context,
      executionId: saved.id,
    };
  }

  /**
   * 更新执行记录为成功
   */
  async markExecutionSuccess(
    executionId: string,
    result: {
      stepsCount: number;
      durationMs: number;
      outputData?: Record<string, any>;
    },
  ): Promise<void> {
    await this.executionRepo.update(executionId, {
      status: 'success',
      stepsCount: result.stepsCount,
      durationMs: result.durationMs,
      outputData: result.outputData || {},
      completedAt: new Date(),
    });
  }

  /**
   * 更新执行记录为失败
   */
  async markExecutionFailed(
    executionId: string,
    error: {
      errorMessage: string;
      durationMs: number;
      stepsCount?: number;
    },
  ): Promise<void> {
    await this.executionRepo.update(executionId, {
      status: 'failed',
      errorMessage: error.errorMessage,
      durationMs: error.durationMs,
      stepsCount: error.stepsCount || 0,
      completedAt: new Date(),
    });
  }

  /**
   * 获取 Skill 执行历史
   */
  async getExecutionHistory(
    userId: string,
    skillId?: string,
    limit = 20,
  ): Promise<SkillExecutionEntity[]> {
    const where: any = { userId };
    if (skillId) where.skillId = skillId;

    return this.executionRepo.find({
      where,
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取单次执行详情
   */
  async getExecutionDetail(
    executionId: string,
  ): Promise<SkillExecutionEntity | null> {
    return this.executionRepo.findOne({
      where: { id: executionId },
    });
  }

  // ==================== 注册表管理 ====================

  /**
   * 热重载 Skill（代理到 Registry）
   */
  async reloadSkills(skillId?: string): Promise<number> {
    return this.registry.reload(skillId);
  }

  /**
   * 获取注册表统计
   */
  getRegistryStats() {
    return this.registry.getStats();
  }

  // ==================== 内部方法 ====================
}
