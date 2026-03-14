import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AgentService } from '../agent/agent.service';
import { UserService } from '../user/user.service';
import { EmailChannel } from '../notification/channels/email.channel';
import type { UserEntity } from '../../common/database/entities/user.entity';

/**
 * 定时任务调度服务
 *
 * - 每分钟轮询，检查是否有用户的 notifyTime 匹配当前时刻（HH:MM），匹配则触发 Agent 执行
 * - 支持 detailedNotify 偏好：开启后在 Agent 启动时发通知邮件，失败时发详细报错邮件
 * - Agent 异常时发告警邮件通知
 * - 提供手动触发入口
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  /** 正在执行 Agent 的用户 ID 集合（支持多用户并行但同一用户不重复） */
  private readonly runningUsers = new Set<string>();

  /** 今日已执行过的用户 ID 集合（防止同一天重复触发） */
  private todayExecutedUsers = new Set<string>();

  /** 当前日期标记（用于跨天重置） */
  private currentDate = '';

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
   * 每分钟轮询：检查用户的 notifyTime 是否匹配当前时刻（HH:MM）
   * Cron 表达式: 秒 分 时 日 月 星期 → 每分钟第 0 秒执行
   */
  @Cron('0 * * * * *', { name: 'daily-agent-poll' })
  async handleAgentPoll(): Promise<void> {
    // 始终使用中国时区（Asia/Shanghai），避免服务器 UTC 时区导致时间不匹配
    const now = new Date();
    const cnFormatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = cnFormatter.formatToParts(now);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value || '00';
    const todayStr = `${get('year')}-${get('month')}-${get('day')}`;
    const currentHHMM = `${get('hour')}:${get('minute')}`;

    // 跨天重置已执行集合
    if (this.currentDate !== todayStr) {
      this.todayExecutedUsers.clear();
      this.currentDate = todayStr;
      this.logger.log(`日期切换至 ${todayStr}，重置已执行用户列表（时区: Asia/Shanghai）`);
    }

    try {
      const users = await this.userService.findAll();
      if (users.length === 0) return;

      for (const user of users) {
        const notifyTime = this.getUserNotifyTime(user);

        // 匹配当前时刻（北京时间 HH:MM）+ 今日未执行 + 当前未在运行
        if (
          notifyTime === currentHHMM &&
          !this.todayExecutedUsers.has(user.id) &&
          !this.runningUsers.has(user.id)
        ) {
          this.logger.log(
            `用户 ${user.name} 的推送时间 ${notifyTime} 匹配当前时刻，触发 Agent 执行`,
          );
          // 异步执行，不阻塞轮询
          void this.executeAgentForUser(user);
        }
      }
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`Agent 轮询异常: ${errMsg}`);
    }
  }

  /**
   * 为单个用户执行 Agent 全流程
   */
  private async executeAgentForUser(user: UserEntity): Promise<void> {
    this.runningUsers.add(user.id);
    this.todayExecutedUsers.add(user.id);

    const detailedNotify = this.isDetailedNotifyEnabled(user);
    const userEmail = user.email || this.alertEmail;

    try {
      // detailedNotify 开启时，发送 Agent 启动通知
      if (detailedNotify && userEmail) {
        await this.sendAgentStartNotify(user, userEmail);
      }

      this.logger.log(`执行 Agent 推送: userId=${user.id}, name=${user.name}`);
      const result = await this.agentService.runDailyDigest(user.id);
      this.logger.log(
        `Agent 推送完成: userId=${user.id}, steps=${result.stepsUsed}, ` +
          `digest=${result.digestSent}, fallback=${result.isFallback}, ` +
          `duration=${result.totalDurationMs}ms`,
      );

      // Agent 失败且未成功推送
      if (!result.isSuccess && !result.digestSent) {
        const detail =
          `用户: ${user.name} (${user.id})\n` +
          `是否兜底: ${result.isFallback}\n` +
          `Agent 报告: ${result.report}\n` +
          `步骤数: ${result.stepsUsed}\n` +
          `耗时: ${result.totalDurationMs}ms`;

        // detailedNotify 开启：给用户邮箱发详细报错
        if (detailedNotify && userEmail) {
          await this.sendDetailedFailureEmail(
            user,
            userEmail,
            '每日 Agent 推送失败',
            detail,
          );
        }
        // 始终给管理员发告警
        await this.sendAlertEmail('每日 Agent 推送失败', detail);
      }
    } catch (error) {
      const err = error as Error;
      const errMsg = err.message;
      const errStack = err.stack || '';
      this.logger.error(`Agent 推送失败 (userId=${user.id}): ${errMsg}`);

      // detailedNotify 开启：给用户邮箱发详细异常报错
      if (detailedNotify && userEmail) {
        const detail =
          `用户: ${user.name} (${user.id})\n` +
          `异常信息: ${errMsg}\n\n` +
          `堆栈信息:\n${errStack}`;
        await this.sendDetailedFailureEmail(
          user,
          userEmail,
          '每日 Agent 推送异常',
          detail,
        );
      }
      await this.sendAlertEmail(
        '每日 Agent 推送异常',
        `用户: ${user.name} (${user.id})\n异常信息: ${errMsg}`,
      );
    } finally {
      this.runningUsers.delete(user.id);
    }
  }

  /**
   * 每周日 10:00 触发 Agent 执行周报 + 反思（预留）
   */
  @Cron('0 0 10 * * 0', { name: 'weekly-review' })
  handleWeeklyReview(): void {
    this.logger.log('=== 定时任务: 周报与反思（预留）===');
    // TODO: 实现周报生成和 Agent 反思逻辑
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    runningUsers: string[];
    todayExecutedUsers: string[];
    schedules: { name: string; cron: string; description: string }[];
  } {
    return {
      runningUsers: Array.from(this.runningUsers),
      todayExecutedUsers: Array.from(this.todayExecutedUsers),
      schedules: [
        {
          name: 'daily-agent-poll',
          cron: '0 * * * * *',
          description:
            '每分钟轮询，匹配用户 notifyTime（HH:MM）后触发 Agent 全流程',
        },
        {
          name: 'weekly-review',
          cron: '0 0 10 * * 0',
          description: '每周日 10:00 执行周报与反思',
        },
      ],
    };
  }

  // ─── 工具方法 ────────────────────────────────────────────

  /**
   * 从用户偏好中获取 notifyTime，兼容旧字段名 pushTime，默认 08:00
   */
  private getUserNotifyTime(user: UserEntity): string {
    const preferences = user.preferences || {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return preferences.notifyTime || preferences.pushTime || '08:00';
  }

  /**
   * 判断用户是否开启了详细通知
   */
  private isDetailedNotifyEnabled(user: UserEntity): boolean {
    const preferences = user.preferences || {};
    return preferences.detailedNotify === true;
  }

  // ─── 邮件通知 ────────────────────────────────────────────

  /**
   * 发送 Agent 启动通知邮件（detailedNotify 开启时）
   */
  private async sendAgentStartNotify(
    user: UserEntity,
    toEmail: string,
  ): Promise<void> {
    if (!this.emailChannel.isAvailable()) return;

    const time = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });

    const subject = `🤖 News Agent 已启动每日推送 - ${user.name}`;
    const html = `
      <div style="max-width:560px;margin:0 auto;padding:24px;font-family:sans-serif;">
        <h2 style="color:#2563eb;">🤖 Agent 已启动</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px;font-weight:600;color:#374151;">启动时间</td>
            <td style="padding:8px;">${time}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:600;color:#374151;">用户</td>
            <td style="padding:8px;">${this.escapeHtml(user.name)}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:600;color:#374151;">任务</td>
            <td style="padding:8px;">每日内容采集 → AI 评分 → 摘要生成 → 邮件推送</td>
          </tr>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">
          Agent 正在执行中，完成后将自动发送每日精选邮件。如遇异常将另行通知。
        </p>
        <p style="margin-top:8px;font-size:12px;color:#9ca3af;">
          此通知可在「偏好设置 → 详细运行通知」中关闭。
        </p>
      </div>`;
    const text = `News Agent 已启动\n用户: ${user.name}\n启动时间: ${time}\n\nAgent 正在执行每日推送全流程，完成后将发送精选邮件。`;

    try {
      await this.emailChannel.send({ to: toEmail, subject, html, text });
      this.logger.log(`Agent 启动通知已发送至 ${toEmail}`);
    } catch (e) {
      this.logger.error(`Agent 启动通知发送失败: ${(e as Error).message}`);
    }
  }

  /**
   * 发送详细失败报错邮件（detailedNotify 开启时，发给用户邮箱）
   */
  private async sendDetailedFailureEmail(
    user: UserEntity,
    toEmail: string,
    title: string,
    detail: string,
  ): Promise<void> {
    if (!this.emailChannel.isAvailable()) return;

    const time = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });

    const subject = `❌ News Agent 执行失败 - ${this.escapeHtml(title)}`;
    const html = `
      <div style="max-width:640px;margin:0 auto;padding:24px;font-family:sans-serif;">
        <h2 style="color:#dc2626;">❌ ${this.escapeHtml(title)}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px;font-weight:600;color:#374151;vertical-align:top;">告警时间</td>
            <td style="padding:8px;">${time}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:600;color:#374151;vertical-align:top;">用户</td>
            <td style="padding:8px;">${this.escapeHtml(user.name)}</td>
          </tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
          <div style="font-size:13px;font-weight:600;color:#991b1b;margin-bottom:8px;">详细报错信息</div>
          <pre style="margin:0;font-size:12px;color:#991b1b;white-space:pre-wrap;word-break:break-all;font-family:monospace;">${this.escapeHtml(detail)}</pre>
        </div>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">
          请检查 LLM API 配置、网络连接和数据源状态。今日推送将不会执行，明日将自动重试。
        </p>
        <p style="margin-top:8px;font-size:12px;color:#9ca3af;">
          此通知可在「偏好设置 → 详细运行通知」中关闭。
        </p>
      </div>`;
    const text = `News Agent 执行失败: ${title}\n用户: ${user.name}\n时间: ${time}\n\n${detail}`;

    try {
      await this.emailChannel.send({ to: toEmail, subject, html, text });
      this.logger.log(`详细失败通知已发送至 ${toEmail}: ${title}`);
    } catch (e) {
      this.logger.error(`详细失败通知发送失败: ${(e as Error).message}`);
    }
  }

  /**
   * 发送告警邮件 — 任何环节异常时通知管理员（ALERT_EMAIL）
   */
  private async sendAlertEmail(title: string, detail: string): Promise<void> {
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
      this.logger.error(`告警邮件发送失败: ${(e as Error).message}`);
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
