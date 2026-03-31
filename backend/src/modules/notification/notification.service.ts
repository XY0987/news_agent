import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserEntity } from '../../common/database/entities/user.entity';
import { DigestEntity } from '../../common/database/entities/digest.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';
import { SourceEntity } from '../../common/database/entities/source.entity';
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
    @InjectRepository(SourceEntity)
    private readonly sourceRepo: Repository<SourceEntity>,
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
        createdAt: MoreThanOrEqual(today),
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
  }): Promise<{
    success: boolean;
    message: string;
    digestId: string;
    channels: Record<string, any>;
  }> {
    const { userId, contentIds, agentNote } = params;

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error(`用户 ${userId} 不存在`);

    if (!contentIds || contentIds.length === 0) {
      throw new Error('contentIds 不能为空');
    }

    const contents = await this.contentRepo.findBy({ id: In(contentIds) });

    // 按 Source 类型分流：GitHub 内容复用 sendGithubTrending，文章走 sendViaEmail
    const sourceIds = [
      ...new Set(contents.map((c) => c.sourceId).filter(Boolean)),
    ];
    const sources =
      sourceIds.length > 0
        ? await this.sourceRepo.findBy({ id: In(sourceIds) })
        : [];
    const githubSourceIds = new Set(
      sources.filter((s) => s.type === 'github').map((s) => s.id),
    );

    const articleContentIds = contentIds.filter((id) => {
      const c = contents.find((ct) => ct.id === id);
      return c && !githubSourceIds.has(c.sourceId);
    });
    const githubContentIds = contentIds.filter((id) => {
      const c = contents.find((ct) => ct.id === id);
      return c && githubSourceIds.has(c.sourceId);
    });

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
    const rendered = this.renderDigest(
      contents,
      scoreMap,
      interactionMap,
      agentNote,
    );

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

    // 1. 文章邮件
    if (articleContentIds.length > 0) {
      const articleContents = contents.filter(
        (c) => !githubSourceIds.has(c.sourceId),
      );
      channelResults.email = await this.sendViaEmail(
        user,
        articleContents,
        scoreMap,
        interactionMap,
        agentNote,
      );
    }

    // 2. GitHub 邮件（复用已有的 sendGithubTrending）
    if (githubContentIds.length > 0) {
      const ghResult = await this.sendGithubTrending({
        userId,
        contentIds: githubContentIds,
        agentNote,
      });
      channelResults.github = {
        success: ghResult.success,
        message: ghResult.message,
      };
    }

    // 更新推送时间
    const anySuccess = Object.values(channelResults).some(
      (r: any) => r.success,
    );
    if (anySuccess) {
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

    this.logger.log(
      `每日精选推送: userId=${userId}, 文章 ${articleContentIds.length} 篇, GitHub ${githubContentIds.length} 个, digestId=${savedDigest.id}`,
    );

    return {
      success: anySuccess,
      message: anySuccess
        ? `推送成功：文章 ${articleContentIds.length} 篇, GitHub 仓库 ${githubContentIds.length} 个`
        : `推送已保存但发送失败`,
      digestId: savedDigest.id,
      channels: channelResults,
    };
  }

  /**
   * 通过邮件发送每日精选（纯文章）
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
  async sendTestEmail(
    email: string,
  ): Promise<{ success: boolean; error?: string }> {
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
  async getChannelStatus(): Promise<
    Record<string, { available: boolean; configured: boolean }>
  > {
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
   * 发送 GitHub 热点趋势邮件（独立于每日精选，单独推送）
   */
  async sendGithubTrending(params: {
    userId: string;
    contentIds: string[];
    agentNote?: string;
  }): Promise<{ success: boolean; message: string; digestId: string }> {
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

    // 保存推送记录（type 标记为 github_trending）
    const digest = this.digestRepo.create({
      userId,
      type: 'daily',
      contentIds,
      renderedContent: `# GitHub 热点趋势\n\n${contents.map((c) => `- ${c.title}`).join('\n')}`,
    });
    const savedDigest = await this.digestRepo.save(digest);

    // 发送 GitHub 专属邮件
    const email = user.email || (user.notificationSettings as any)?.email;
    if (!email) {
      return {
        success: false,
        message: '用户未配置邮箱地址',
        digestId: savedDigest.id,
      };
    }

    if (!this.emailChannel.isAvailable()) {
      return {
        success: false,
        message: 'SMTP 未配置，邮件通道不可用',
        digestId: savedDigest.id,
      };
    }

    const date = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    // 组装 GitHub 仓库数据
    const items = contents.map((content, index) => {
      const score = scoreMap.get(content.id);
      const interaction = interactionMap.get(content.id);
      const meta = (content.metadata || {}) as Record<string, any>;

      return {
        index: index + 1,
        title: content.title || '无标题',
        fullName: (meta.fullName as string) || content.author || '',
        description: (meta.description as string) || '',
        language: (meta.language as string) || '',
        stars: (meta.stars as number) || 0,
        starsToday: (meta.starsToday as number) || 0,
        forks: (meta.forks as number) || 0,
        trendSource: (meta.trendSource as string) || '',
        topics: (meta.topics as string[]) || [],
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

    // 按 star 数排序
    items.sort((a, b) => b.stars - a.stars);

    const emailResult = await this.emailChannel.sendGithubTrendingEmail(email, {
      date,
      agentNote,
      items,
    });

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

    this.logger.log(
      `GitHub 热点推送: userId=${userId}, 仓库 ${items.length} 个, digestId=${savedDigest.id}, 邮件=${emailResult.success ? '✓' : '✗'}`,
    );

    return {
      success: emailResult.success,
      message: emailResult.success
        ? `GitHub 热点推送成功，包含 ${items.length} 个热门仓库`
        : `推送已保存但发送失败: ${emailResult.error || '未知错误'}`,
      digestId: savedDigest.id,
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
