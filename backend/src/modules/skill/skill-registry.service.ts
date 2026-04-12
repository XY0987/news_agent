import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import { SkillParserService } from './skill-parser.service.js';
import type { ParsedSkill, SkillRegistryEntry } from './skill.types.js';

/**
 * Skill 注册表
 *
 * 对标 CodeBuddy / Cursor / Claude Code 标准 Skill 格式：
 * - frontmatter 只包含 name + description
 * - 触发匹配基于 description 文本（由 AI 根据 description 判断是否使用 Skill）
 *
 * 核心职责：
 * 1. discover()  — 扫描 skills/ 目录，发现所有含 SKILL.md 的子目录
 * 2. load()      — 加载并解析 SKILL.md
 * 3. register()  — 注册到内存注册表
 * 4. get()       — 获取已注册的 Skill
 * 5. list()      — 列出所有 Skill（支持筛选）
 * 6. resolve()   — 根据描述匹配 Skill
 * 7. reload()    — 热重载（单个或全部）
 */
@Injectable()
export class SkillRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistryService.name);

  /** 内存注册表：skillId → SkillRegistryEntry */
  private readonly registry = new Map<string, SkillRegistryEntry>();

  /** Skills 根目录（默认为 backend/skills/） */
  private skillsRootDir: string;

  constructor(private readonly parser: SkillParserService) {
    // 默认 skills/ 在 backend 根目录下
    this.skillsRootDir = path.resolve(process.cwd(), 'skills');
  }

  /**
   * NestJS 模块初始化时自动扫描并加载所有 Skill
   */
  onModuleInit(): void {
    this.logger.log(`初始化 SkillRegistry，扫描目录: ${this.skillsRootDir}`);
    this.discoverAndLoadAll();
  }

  // ==================== 公开 API ====================

  /**
   * 扫描 skills/ 目录并加载所有 Skill
   */
  discoverAndLoadAll(): number {
    const dirs = this.parser.discoverSkillDirs(this.skillsRootDir);
    let loadedCount = 0;

    for (const dir of dirs) {
      const skill = this.parser.parseSkillDir(dir);
      if (skill) {
        this.register(skill);
        loadedCount++;
      }
    }

    this.logger.log(
      `SkillRegistry 加载完成: ${loadedCount}/${dirs.length} 个 Skill`,
    );
    return loadedCount;
  }

  /**
   * 加载单个 Skill（按目录路径）
   */
  load(skillDirPath: string): ParsedSkill | null {
    const skill = this.parser.parseSkillDir(skillDirPath);
    if (skill) {
      this.register(skill);
    }
    return skill;
  }

  /**
   * 按 skillId 加载（拼接默认路径）
   */
  loadById(skillId: string): ParsedSkill | null {
    const dirPath = path.join(this.skillsRootDir, skillId);
    return this.load(dirPath);
  }

  /**
   * 注册 Skill 到内存注册表
   */
  register(skill: ParsedSkill): void {
    const existing = this.registry.get(skill.id);
    if (existing) {
      this.logger.warn(`Skill "${skill.id}" 已注册，将被覆盖`);
    }

    this.registry.set(skill.id, {
      skill,
      isAvailable: true,
      registeredAt: new Date(),
    });

    this.logger.log(`Skill 注册成功: ${skill.id} (${skill.frontmatter.name})`);
  }

  /**
   * 从注册表移除 Skill
   */
  unregister(skillId: string): boolean {
    const existed = this.registry.delete(skillId);
    if (existed) {
      this.logger.log(`Skill 已注销: ${skillId}`);
    }
    return existed;
  }

  /**
   * 获取已注册的 Skill
   */
  get(skillId: string): SkillRegistryEntry | undefined {
    return this.registry.get(skillId);
  }

  /**
   * 获取已注册的 Skill（抛异常版本）
   */
  getOrThrow(skillId: string): SkillRegistryEntry {
    const entry = this.registry.get(skillId);
    if (!entry) {
      throw new Error(`Skill 未注册: ${skillId}`);
    }
    return entry;
  }

  /**
   * 列出所有已注册的 Skill（支持筛选）
   */
  list(filters?: { isAvailable?: boolean }): SkillRegistryEntry[] {
    let entries = Array.from(this.registry.values());

    if (!filters) return entries;

    if (filters.isAvailable !== undefined) {
      entries = entries.filter((e) => e.isAvailable === filters.isAvailable);
    }

    return entries;
  }

  /**
   * 根据用户输入匹配 Skill（基于 description 文本匹配）
   *
   * 标准 Skill 格式中，触发匹配主要由 AI 根据 description 来决定，
   * 这里提供一个简单的关键词匹配作为辅助。
   *
   * @param userInput 用户输入文本
   * @returns 匹配到的 Skill 列表
   */
  resolve(userInput: string): SkillRegistryEntry[] {
    const matched: SkillRegistryEntry[] = [];
    const input = userInput.toLowerCase();

    for (const entry of this.registry.values()) {
      if (!entry.isAvailable) continue;

      const desc = entry.skill.frontmatter.description.toLowerCase();
      // 简单匹配：检查用户输入中是否包含 description 中提到的关键词
      // 实际场景中，AI 会根据完整的 description 来判断是否使用该 Skill
      const words = input.split(/\s+/);
      const isMatch = words.some(
        (word) => word.length > 1 && desc.includes(word),
      );
      if (isMatch) {
        matched.push(entry);
      }
    }

    if (matched.length > 0) {
      this.logger.log(
        `描述匹配: 匹配到 ${matched.length} 个 Skill: ${matched.map((e) => e.skill.id).join(', ')}`,
      );
    }

    return matched;
  }

  /**
   * 按 skillId 精确匹配（手动触发场景）
   */
  resolveById(skillId: string): SkillRegistryEntry | undefined {
    const entry = this.registry.get(skillId);
    if (entry && entry.isAvailable) {
      return entry;
    }
    return undefined;
  }

  /**
   * 获取所有 Skill 的摘要信息（用于 AI 上下文中展示可用 Skills 列表）
   */
  getSkillSummaries(): Array<{ name: string; description: string }> {
    return Array.from(this.registry.values())
      .filter((e) => e.isAvailable)
      .map((e) => ({
        name: e.skill.frontmatter.name,
        description: e.skill.frontmatter.description,
      }));
  }

  /**
   * 热重载 Skill（单个或全部）
   */
  reload(skillId?: string): number {
    if (skillId) {
      // 重载单个
      const entry = this.registry.get(skillId);
      if (!entry) {
        this.logger.warn(`热重载失败: Skill "${skillId}" 未注册`);
        return 0;
      }

      const reloaded = this.parser.parseSkillDir(entry.skill.dirPath);
      if (reloaded) {
        this.register(reloaded);
        this.logger.log(`Skill "${skillId}" 热重载成功`);
        return 1;
      }
      return 0;
    }

    // 重载全部
    this.registry.clear();
    return this.discoverAndLoadAll();
  }

  /**
   * 设置 Skill 可用状态
   */
  setAvailable(skillId: string, isAvailable: boolean): void {
    const entry = this.registry.get(skillId);
    if (entry) {
      entry.isAvailable = isAvailable;
      this.logger.log(`Skill "${skillId}" 可用状态更新: ${isAvailable}`);
    }
  }

  /**
   * 获取注册表统计信息
   */
  getStats(): {
    total: number;
    available: number;
  } {
    const entries = Array.from(this.registry.values());
    return {
      total: entries.length,
      available: entries.filter((e) => e.isAvailable).length,
    };
  }

  /**
   * 获取 Skills 根目录路径
   */
  getSkillsRootDir(): string {
    return this.skillsRootDir;
  }

  /**
   * 设置 Skills 根目录路径（测试用）
   */
  setSkillsRootDir(dir: string): void {
    this.skillsRootDir = dir;
  }
}
