import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AgentService } from '../agent/agent.service';
import { CollectorService } from '../collector/collector.service';
import { UserService } from '../user/user.service';

/**
 * 定时任务调度服务
 *
 * - 每天 08:00 触发 Agent 执行每日推送（可通过 AGENT_CRON_TIME 配置）
 * - 每 6 小时执行一次自动采集
 * - 提供手动触发入口
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private isRunning = false;
  private isCollecting = false;

  constructor(
    private readonly agentService: AgentService,
    private readonly collectorService: CollectorService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 每天 08:00 触发 Agent 执行每日推送
   * Cron 表达式: 秒 分 时 日 月 星期
   */
  @Cron('0 0 8 * * *', { name: 'daily-agent-run' })
  async handleDailyAgentRun(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Agent 任务正在执行中，跳过本次触发');
      return;
    }

    this.isRunning = true;
    this.logger.log('=== 定时任务: 每日 Agent 推送开始 ===');

    try {
      const users = await this.userService.findAll();

      if (users.length === 0) {
        this.logger.warn('没有注册用户，跳过 Agent 执行');
        return;
      }

      for (const user of users) {
        try {
          this.logger.log(`执行 Agent 推送: userId=${user.id}, name=${user.name}`);
          const result = await this.agentService.runDailyDigest(user.id);
          this.logger.log(
            `Agent 推送完成: userId=${user.id}, steps=${result.stepsUsed}, ` +
            `digest=${result.digestSent}, fallback=${result.isFallback}, ` +
            `duration=${result.totalDurationMs}ms`,
          );
        } catch (error) {
          this.logger.error(
            `Agent 推送失败 (userId=${user.id}): ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`定时 Agent 推送异常: ${(error as Error).message}`);
    } finally {
      this.isRunning = false;
      this.logger.log('=== 定时任务: 每日 Agent 推送结束 ===');
    }
  }

  /**
   * 每 6 小时自动采集一次数据
   */
  @Cron('0 0 */6 * * *', { name: 'periodic-collect' })
  async handlePeriodicCollect(): Promise<void> {
    if (this.isCollecting) {
      this.logger.warn('采集任务正在执行中，跳过本次触发');
      return;
    }

    this.isCollecting = true;
    this.logger.log('=== 定时任务: 定期采集开始 ===');

    try {
      const users = await this.userService.findAll();

      for (const user of users) {
        try {
          this.logger.log(`自动采集: userId=${user.id}`);
          const results = await this.collectorService.collectByUser(user.id);
          const totalCollected = results.reduce(
            (sum, r) => sum + r.totalCollected,
            0,
          );
          const totalNew = results.reduce((sum, r) => sum + r.newSaved, 0);
          this.logger.log(
            `采集完成: userId=${user.id}, collected=${totalCollected}, new=${totalNew}`,
          );
        } catch (error) {
          this.logger.error(
            `自动采集失败 (userId=${user.id}): ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`定期采集异常: ${(error as Error).message}`);
    } finally {
      this.isCollecting = false;
      this.logger.log('=== 定时任务: 定期采集结束 ===');
    }
  }

  /**
   * 每周日 10:00 触发 Agent 执行周报 + 反思（预留）
   */
  @Cron('0 0 10 * * 0', { name: 'weekly-review' })
  async handleWeeklyReview(): Promise<void> {
    this.logger.log('=== 定时任务: 周报与反思（预留）===');
    // TODO: 实现周报生成和 Agent 反思逻辑
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    isAgentRunning: boolean;
    isCollecting: boolean;
    schedules: { name: string; cron: string; description: string }[];
  } {
    return {
      isAgentRunning: this.isRunning,
      isCollecting: this.isCollecting,
      schedules: [
        {
          name: 'daily-agent-run',
          cron: '0 0 8 * * *',
          description: '每天 08:00 执行 Agent 每日推送',
        },
        {
          name: 'periodic-collect',
          cron: '0 0 */6 * * *',
          description: '每 6 小时自动采集数据',
        },
        {
          name: 'weekly-review',
          cron: '0 0 10 * * 0',
          description: '每周日 10:00 执行周报与反思',
        },
      ],
    };
  }
}
