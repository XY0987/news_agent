import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserEntity } from '../../common/database/entities/user.entity';
import { DigestEntity } from '../../common/database/entities/digest.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';

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
  ) {}

  /**
   * 发送每日精选 - Agent Tool 入口
   */
  async sendDigest(params: {
    userId: string;
    contentIds: string[];
    agentNote?: string;
  }): Promise<{ success: boolean; message: string; digestId: string }> {
    const { userId, contentIds, agentNote } = params;

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error(`用户 ${userId} 不存在`);

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

    // 渲染推送内容
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
      sentAt: new Date(),
    });
    const savedDigest = await this.digestRepo.save(digest);

    // TODO: 实际发送邮件/Telegram（会话 4 实现）
    this.logger.log(
      `每日精选已生成: userId=${userId}, 内容 ${contentIds.length} 篇, digestId=${savedDigest.id}`,
    );

    return {
      success: true,
      message: `每日精选推送成功，包含 ${contentIds.length} 篇内容`,
      digestId: savedDigest.id,
    };
  }

  /**
   * 渲染推送内容
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

      if (content.url) {
        rendered += `\n🔗 [阅读原文](${content.url})\n`;
      }

      rendered += '\n---\n\n';
    });

    return rendered;
  }
}
