import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: Transporter | null = null;
  private from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('notification.smtp.from') || '';
    this.initTransporter();
  }

  private initTransporter(): void {
    const host = this.configService.get<string>('notification.smtp.host');
    const user = this.configService.get<string>('notification.smtp.user');
    const password = this.configService.get<string>('notification.smtp.password');

    if (!host || !user || !password) {
      this.logger.warn('SMTP 配置不完整，邮件推送功能不可用');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('notification.smtp.port') || 465,
      secure: this.configService.get<boolean>('notification.smtp.secure') !== false,
      auth: { user, pass: password },
    });

    this.logger.log(`SMTP 邮件通道已初始化: ${host}`);
  }

  /**
   * 检查邮件通道是否可用
   */
  isAvailable(): boolean {
    return this.transporter !== null;
  }

  /**
   * 验证 SMTP 连接
   */
  async verify(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(`SMTP 连接验证失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 发送邮件
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP 未配置，邮件通道不可用' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from || options.to,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`邮件发送成功: to=${options.to}, messageId=${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      const msg = (error as Error).message;
      this.logger.error(`邮件发送失败: to=${options.to}, error=${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * 发送每日精选邮件
   */
  async sendDigestEmail(
    to: string,
    digestData: {
      date: string;
      agentNote?: string;
      items: {
        index: number;
        title: string;
        author: string;
        url: string;
        finalScore: number;
        breakdown: Record<string, number>;
        summary: string;
        actionSuggestions: { type: string; suggestion: string }[];
      }[];
    },
  ): Promise<EmailResult> {
    const subject = `📰 每日精选 - ${digestData.date}`;
    const html = this.renderDigestHtml(digestData);
    const text = this.renderDigestText(digestData);
    return this.send({ to, subject, html, text });
  }

  /**
   * 渲染每日精选 HTML 邮件
   * 高分文章（>=60）完整展开，低分文章折叠（需点击展开查看）
   */
  private renderDigestHtml(data: {
    date: string;
    agentNote?: string;
    items: {
      index: number;
      title: string;
      author: string;
      url: string;
      finalScore: number;
      breakdown: Record<string, number>;
      summary: string;
      actionSuggestions: { type: string; suggestion: string }[];
    }[];
  }): string {
    const HIGH_SCORE_THRESHOLD = 60;
    const highItems = data.items.filter(i => i.finalScore >= HIGH_SCORE_THRESHOLD);
    const lowItems = data.items.filter(i => i.finalScore < HIGH_SCORE_THRESHOLD);

    const renderFullItem = (item: typeof data.items[0]) => `
      <div style="margin-bottom:24px;padding:20px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
        <h3 style="margin:0 0 8px;font-size:18px;color:#1a1a1a;">
          <a href="${this.escapeHtml(item.url)}" style="color:#2563eb;text-decoration:none;" target="_blank">
            ${item.index}. ${this.escapeHtml(item.title)}
          </a>
        </h3>
        <div style="font-size:13px;color:#6b7280;margin-bottom:12px;">
          来源: ${this.escapeHtml(item.author)} &nbsp;|&nbsp; 
          综合评分: <strong style="color:#059669;">${item.finalScore}</strong>
          <span style="color:#9ca3af;margin-left:8px;">
            (相关 ${item.breakdown.relevance || 0} | 质量 ${item.breakdown.quality || 0} | 时效 ${item.breakdown.timeliness || 0})
          </span>
        </div>
        ${item.summary ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">${this.escapeHtml(item.summary)}</p>` : ''}
        ${
          item.actionSuggestions.length > 0
            ? `<div style="background:#f0fdf4;padding:12px;border-radius:6px;margin-top:8px;">
                <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:6px;">💡 行动建议</div>
                ${item.actionSuggestions.map((s) => `<div style="font-size:13px;color:#15803d;margin-bottom:4px;">• ${this.escapeHtml(s.suggestion)}</div>`).join('')}
              </div>`
            : ''
        }
        <div style="margin-top:12px;">
          <a href="${this.escapeHtml(item.url)}" style="display:inline-block;padding:6px 16px;background:#2563eb;color:#fff;border-radius:4px;font-size:13px;text-decoration:none;" target="_blank">阅读原文 →</a>
        </div>
      </div>`;

    const renderCollapsedItem = (item: typeof data.items[0]) => `
      <div style="margin-bottom:8px;padding:12px 16px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="flex:1;min-width:0;">
            <a href="${this.escapeHtml(item.url)}" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500;" target="_blank">
              ${this.escapeHtml(item.title)}
            </a>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
              ${this.escapeHtml(item.author)} · 评分 ${item.finalScore}
            </div>
          </div>
          <a href="${this.escapeHtml(item.url)}" style="display:inline-block;padding:4px 10px;background:#f3f4f6;color:#374151;border-radius:4px;font-size:12px;text-decoration:none;white-space:nowrap;margin-left:12px;" target="_blank">查看 →</a>
        </div>
      </div>`;

    const highItemsHtml = highItems.map(renderFullItem).join('');

    // 低分文章用 details/summary 实现折叠（兼容大多数邮件客户端）
    const lowItemsHtml = lowItems.length > 0
      ? `
      <div style="margin-top:32px;">
        <details>
          <summary style="cursor:pointer;font-size:16px;font-weight:600;color:#6b7280;padding:8px 0;list-style:none;-webkit-appearance:none;">
            📂 更多文章 (${lowItems.length} 篇，评分 &lt; ${HIGH_SCORE_THRESHOLD}) — 点击展开
          </summary>
          <div style="margin-top:12px;">
            ${lowItems.map(renderCollapsedItem).join('')}
          </div>
        </details>
      </div>`
      : '';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="margin:0;font-size:24px;color:#1a1a1a;">📰 每日精选</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${data.date}</p>
    </div>
    ${data.agentNote ? `<div style="background:#eff6ff;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:14px;color:#1e40af;border-left:4px solid #3b82f6;">💡 ${this.escapeHtml(data.agentNote)}</div>` : ''}
    <div style="font-size:13px;color:#6b7280;margin-bottom:16px;padding:8px 12px;background:#f9fafb;border-radius:6px;">
      共 ${data.items.length} 篇文章 · 精选推荐 ${highItems.length} 篇 · 其他 ${lowItems.length} 篇
    </div>
    ${highItems.length > 0 ? `<h2 style="font-size:18px;color:#1a1a1a;margin-bottom:16px;">🔥 精选推荐 (${highItems.length} 篇)</h2>` : ''}
    ${highItemsHtml}
    ${lowItemsHtml}
    <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;">由 News Agent 智能精选推送</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 渲染纯文本版本（邮件降级）
   */
  private renderDigestText(data: {
    date: string;
    agentNote?: string;
    items: {
      index: number;
      title: string;
      author: string;
      url: string;
      finalScore: number;
      breakdown: Record<string, number>;
      summary: string;
      actionSuggestions: { type: string; suggestion: string }[];
    }[];
  }): string {
    const HIGH_SCORE_THRESHOLD = 60;
    const highItems = data.items.filter(i => i.finalScore >= HIGH_SCORE_THRESHOLD);
    const lowItems = data.items.filter(i => i.finalScore < HIGH_SCORE_THRESHOLD);

    let text = `每日精选 - ${data.date}\n${'='.repeat(40)}\n`;
    text += `共 ${data.items.length} 篇 · 精选 ${highItems.length} 篇 · 其他 ${lowItems.length} 篇\n\n`;

    if (data.agentNote) {
      text += `> ${data.agentNote}\n\n`;
    }

    if (highItems.length > 0) {
      text += `🔥 精选推荐\n${'-'.repeat(30)}\n\n`;
      for (const item of highItems) {
        text += `${item.index}. ${item.title}\n`;
        text += `   来源: ${item.author} | 评分: ${item.finalScore}\n`;
        if (item.summary) text += `   ${item.summary}\n`;
        if (item.actionSuggestions.length > 0) {
          text += `   行动建议:\n`;
          for (const s of item.actionSuggestions) {
            text += `   - ${s.suggestion}\n`;
          }
        }
        text += `   链接: ${item.url}\n\n`;
      }
    }

    if (lowItems.length > 0) {
      text += `\n📂 更多文章\n${'-'.repeat(30)}\n\n`;
      for (const item of lowItems) {
        text += `- ${item.title} (${item.author}, 评分${item.finalScore})\n  ${item.url}\n`;
      }
    }

    return text;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
