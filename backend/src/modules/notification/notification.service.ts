import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserEntity } from '../../common/database/entities/user.entity';
import { DigestEntity } from '../../common/database/entities/digest.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';
import { EmailChannel } from './channels/email.channel';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(ContentScoreEntity)
    private readonly scoreRepo: Repository<ContentScoreEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(DigestEntity)
    private readonly digestRepo: Repository<DigestEntity>,
    @InjectRepository(UserContentInteractionEntity)
    private readonly interactionRepo: Repository<UserContentInteractionEntity>,
    private readonly emailChannel: EmailChannel,
  ) {}

  /**
   * 发送今日已分析的文章到邮箱
   * 自动查找今天有 AI 摘要+评分的文章，按评分排序后发送
   */
  async sendTodayAnalyzed(userId: string): Promise<{
    success: boolean;
    message: string;
    contentCount: number;
    digestId?: string;
  }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error(`用户 ${userId} 不存在`);

    // 今日零点
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 查找今日有 AI 摘要的交互记录
    const interactions = await this.interactionRepo.find({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(today),
      },
    });

    // 过滤出有 summary 的（即已分析过的）
    const analyzedInteractions = interactions.filter(
      (i) => i.summary && i.summary.trim().length > 0,
    );

    if (analyzedInteractions.length === 0) {
      return {
        success: false,
        message: '今日暂无已分析的文章',
        contentCount: 0,
      };
    }

    const contentIds = analyzedInteractions.map((i) => i.contentId);

    // 复用现有的 sendDigest 逻辑
    const result = await this.sendDigest({
      userId,
      contentIds,
      agentNote: '手动发送 — 今日已分析文章汇总',
    });

    return {
      success: result.success,
      message: result.message,
      contentCount: contentIds.length,
      digestId: result.digestId,
    };
  }

  /**
   * 发送每日精选 - Agent Tool 入口
   */
  async sendDigest(params: {
    userId: string;
    contentIds: string[];
    agentNote?: string;
  }): Promise<{ success: boolean; message: string; digestId: string; channels: Record<string, any> }> {
    const { userId, contentIds, agentNote } = params;

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error(`用户 ${userId} 不存在`);

    if (!contentIds || contentIds.length === 0) {
      throw new Error('contentIds 不能为空');
    }

    const contents = await this.contentRepo.findBy({ id: In(contentIds) });

    // 获取评分信息
    const scores = await this.scoreRepo.find({
      where: { userId, contentId: In(contentIds) },
    });
    const scoreMap = new Map(scores.map((s) => [s.contentId, s]));

    // 获取摘要信息
    const interactions = await this.interactionRepo.find({
      where: { userId, contentId: In(contentIds) },
    });
    const interactionMap = new Map(interactions.map((i) => [i.contentId, i]));

    // 标记为已选中
    for (const score of scores) {
      score.isSelected = true;
      score.selectionReason = 'agent_selected';
      await this.scoreRepo.save(score);
    }

    // 渲染 Markdown 推送内容
    const rendered = this.renderDigest(contents, scoreMap, interactionMap, agentNote);

    // 保存推送记录
    const digest = this.digestRepo.create({
      userId,
      type: 'daily',
      contentIds,
      renderedContent: rendered,
    });
    const savedDigest = await this.digestRepo.save(digest);

    // 通过各渠道发送
    const channelResults: Record<string, any> = {};

    // 邮件发送
    const emailResult = await this.sendViaEmail(
      user,
      contents,
      scoreMap,
      interactionMap,
      agentNote,
    );
    channelResults.email = emailResult;

    // 更新推送时间
    if (emailResult.success) {
      savedDigest.sentAt = new Date();
      await this.digestRepo.save(savedDigest);

      // 更新交互记录的 notifiedAt
      for (const contentId of contentIds) {
        let interaction = interactionMap.get(contentId);
        if (!interaction) {
          interaction = this.interactionRepo.create({ userId, contentId });
        }
        interaction.notifiedAt = new Date();
        await this.interactionRepo.save(interaction);
      }
    }

    const allSuccess = Object.values(channelResults).some((r: any) => r.success);

    this.logger.log(
      `每日精选推送: userId=${userId}, 内容 ${contentIds.length} 篇, digestId=${savedDigest.id}, 邮件=${emailResult.success ? '✓' : '✗'}`,
    );

    return {
      success: allSuccess,
      message: allSuccess
        ? `每日精选推送成功，包含 ${contentIds.length} 篇内容`
        : `推送已保存但发送失败: ${emailResult.error || '未知错误'}`,
      digestId: savedDigest.id,
      channels: channelResults,
    };
  }

  /**
   * 通过邮件发送每日精选
   */
  private async sendViaEmail(
    user: UserEntity,
    contents: ContentEntity[],
    scoreMap: Map<string, ContentScoreEntity>,
    interactionMap: Map<string, UserContentInteractionEntity>,
    agentNote?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const email = user.email || (user.notificationSettings as any)?.email;
    if (!email) {
      return { success: false, error: '用户未配置邮箱地址' };
    }

    if (!this.emailChannel.isAvailable()) {
      return { success: false, error: 'SMTP 未配置，邮件通道不可用' };
    }

    const date = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    const items = contents.map((content, index) => {
      const score = scoreMap.get(content.id);
      const interaction = interactionMap.get(content.id);

      return {
        index: index + 1,
        title: content.title || '无标题',
        author: content.author || '未知来源',
        url: content.url || '#',
        finalScore: score?.finalScore || 0,
        breakdown: (score?.scoreBreakdown || {}) as Record<string, number>,
        summary: interaction?.summary || '',
        actionSuggestions: ((interaction?.suggestions as any) || []) as {
          type: string;
          suggestion: string;
        }[],
      };
    });

    return this.emailChannel.sendDigestEmail(email, { date, agentNote, items });
  }

  /**
   * 发送测试邮件
   */
  async sendTestEmail(email: string): Promise<{ success: boolean; error?: string }> {
    if (!this.emailChannel.isAvailable()) {
      return { success: false, error: 'SMTP 未配置' };
    }

    const result = await this.emailChannel.send({
      to: email,
      subject: '🔔 News Agent 测试邮件',
      html: `
        <div style="max-width:480px;margin:0 auto;padding:24px;font-family:sans-serif;">
          <h2>✅ 邮件通道测试成功</h2>
          <p>如果您收到此邮件，说明 News Agent 的邮件推送功能已正常配置。</p>
          <p style="color:#6b7280;font-size:13px;">发送时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>`,
      text: 'News Agent 邮件通道测试成功',
    });

    return { success: result.success, error: result.error };
  }

  /**
   * 检查通知渠道状态
   */
  async getChannelStatus(): Promise<Record<string, { available: boolean; configured: boolean }>> {
    return {
      email: {
        available: this.emailChannel.isAvailable(),
        configured: this.emailChannel.isAvailable(),
      },
      telegram: {
        available: false,
        configured: false,
      },
    };
  }

  /**
   * 渲染推送内容（Markdown 格式，存入 DB）
   */
  private renderDigest(
    contents: ContentEntity[],
    scoreMap: Map<string, ContentScoreEntity>,
    interactionMap: Map<string, UserContentInteractionEntity>,
    agentNote?: string,
  ): string {
    const date = new Date().toLocaleDateString('zh-CN');
    let rendered = `# 每日精选 - ${date}\n\n`;

    if (agentNote) {
      rendered += `> 💡 ${agentNote}\n\n`;
    }

    rendered += `## 🔥 今日推荐 (Top ${contents.length})\n\n`;

    contents.forEach((content, index) => {
      const score = scoreMap.get(content.id);
      const interaction = interactionMap.get(content.id);

      rendered += `### ${index + 1}. ${content.title}\n`;
      rendered += `**来源**: ${content.author || '未知'} | `;

      if (score) {
        rendered += `**综合评分**: ${score.finalScore}\n`;
        const breakdown = score.scoreBreakdown as Record<string, number>;
        if (breakdown) {
          rendered += `> 评分拆解: 相关性 ${breakdown.relevance || 0} | 质量 ${breakdown.quality || 0} | 时效 ${breakdown.timeliness || 0}\n`;
        }
      }

      if (interaction && interaction.summary) {
        rendered += `\n${interaction.summary}\n`;
      }

      if (interaction?.suggestions) {
        const suggestions = interaction.suggestions as any;
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          rendered += `\n**💡 行动建议**:\n`;
          for (const s of suggestions) {
            rendered += `- ${s.suggestion}\n`;
          }
        }
      }

      if (content.url) {
        rendered += `\n🔗 [阅读原文](${content.url})\n`;
      }

      rendered += '\n---\n\n';
    });

    return rendered;
  }
}
