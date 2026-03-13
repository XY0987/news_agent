import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AgentService } from '../agent/agent.service';
import { UserService } from '../user/user.service';
import { EmailChannel } from '../notification/channels/email.channel';

/**
 * 定时任务调度服务
 *
 * - 每天 08:00 触发 Agent 执行每日推送（Agent 自主决策采集、分析、推送全流程）
 * - Agent 异常时发告警邮件通知
 * - 提供手动触发入口
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private isRunning = false;
  private readonly alertEmail: string;

  constructor(
    private readonly agentService: AgentService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly emailChannel: EmailChannel,
  ) {
    this.alertEmail = this.configService.get<string>('ALERT_EMAIL') || '';
  }

  /**
   * 每天 08:00 触发 Agent 执行每日推送（全流程：采集 + 分析 + 推送）
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

          // Agent 失败且未成功推送 → 发告警邮件
          if (!result.isSuccess && !result.digestSent) {
            await this.sendAlertEmail(
              '每日 Agent 推送失败',
              `用户: ${user.name} (${user.id})\n` +
              `是否兜底: ${result.isFallback}\n` +
              `Agent 报告: ${result.report}\n` +
              `步骤数: ${result.stepsUsed}\n` +
              `耗时: ${result.totalDurationMs}ms`,
            );
          }
        } catch (error) {
          const errMsg = (error as Error).message;
          this.logger.error(
            `Agent 推送失败 (userId=${user.id}): ${errMsg}`,
          );
          await this.sendAlertEmail(
            '每日 Agent 推送异常',
            `用户: ${user.name} (${user.id})\n异常信息: ${errMsg}`,
          );
        }
      }
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`定时 Agent 推送异常: ${errMsg}`);
      await this.sendAlertEmail('每日 Agent 推送全局异常', `异常信息: ${errMsg}`);
    } finally {
      this.isRunning = false;
      this.logger.log('=== 定时任务: 每日 Agent 推送结束 ===');
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
    schedules: { name: string; cron: string; description: string }[];
  } {
    return {
      isAgentRunning: this.isRunning,
      schedules: [
        {
          name: 'daily-agent-run',
          cron: '0 0 8 * * *',
          description: '每天 08:00 执行 Agent 每日推送（全流程：采集 + 分析 + 推送）',
        },
        {
          name: 'weekly-review',
          cron: '0 0 10 * * 0',
          description: '每周日 10:00 执行周报与反思',
        },
      ],
    };
  }

  /**
   * 发送告警邮件 — 任何环节异常时通知用户
   */
  private async sendAlertEmail(
    title: string,
    detail: string,
  ): Promise<void> {
    if (!this.alertEmail || !this.emailChannel.isAvailable()) {
      this.logger.warn(
        `告警邮件无法发送（邮箱未配置或 SMTP 不可用）: ${title}`,
      );
      return;
    }

    const time = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });

    const subject = `🚨 News Agent 告警: ${title}`;
    const html = `
      <div style="max-width:560px;margin:0 auto;padding:24px;font-family:sans-serif;">
        <h2 style="color:#dc2626;">🚨 ${this.escapeHtml(title)}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px;font-weight:600;color:#374151;vertical-align:top;">告警时间</td>
            <td style="padding:8px;">${time}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:600;color:#374151;vertical-align:top;">详细信息</td>
            <td style="padding:8px;white-space:pre-wrap;color:#dc2626;">${this.escapeHtml(detail)}</td>
          </tr>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">
          此邮件由 News Agent 定时任务自动发送。请检查服务状态。
        </p>
      </div>`;
    const text = `News Agent 告警: ${title}\n时间: ${time}\n\n${detail}`;

    try {
      await this.emailChannel.send({
        to: this.alertEmail,
        subject,
        html,
        text,
      });
      this.logger.log(`告警邮件已发送至 ${this.alertEmail}: ${title}`);
    } catch (e) {
      this.logger.error(
        `告警邮件发送失败: ${(e as Error).message}`,
      );
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
