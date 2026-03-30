import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { SkillFrontmatter, ParsedSkill } from './skill.types.js';

/**
 * SKILL.md 解析器
 *
 * 对标 CodeBuddy / Cursor / Claude Code 标准 Skill 格式：
 * - frontmatter 只包含 name + description
 * - Markdown 正文即为 Agent 完整指令
 *
 * 负责：
 * 1. 扫描 skills/ 目录发现所有 Skill
 * 2. 解析 SKILL.md（YAML frontmatter + Markdown 正文）
 * 3. 列出 scripts/, references/, assets/ 目录内容
 */
@Injectable()
export class SkillParserService {
  private readonly logger = new Logger(SkillParserService.name);

  /**
   * 扫描指定目录，发现所有包含 SKILL.md 的子目录
   */
  discoverSkillDirs(skillsRootDir: string): string[] {
    if (!fs.existsSync(skillsRootDir)) {
      this.logger.warn(`Skills 目录不存在: ${skillsRootDir}`);
      return [];
    }

    const entries = fs.readdirSync(skillsRootDir, { withFileTypes: true });
    const skillDirs: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // 跳过 _ 开头的目录（如 _template）
      if (entry.name.startsWith('_')) continue;

      const skillMdPath = path.join(skillsRootDir, entry.name, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        skillDirs.push(path.join(skillsRootDir, entry.name));
      }
    }

    this.logger.log(
      `发现 ${skillDirs.length} 个 Skill 目录: ${skillDirs.map((d) => path.basename(d)).join(', ')}`,
    );
    return skillDirs;
  }

  /**
   * 解析单个 Skill 目录
   */
  parseSkillDir(skillDirPath: string): ParsedSkill | null {
    const skillMdPath = path.join(skillDirPath, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      this.logger.error(`SKILL.md 不存在: ${skillMdPath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const { frontmatter, prompt } = this.parseFrontmatterAndContent(content);

      if (!frontmatter) {
        this.logger.error(
          `SKILL.md frontmatter 解析失败: ${skillMdPath}`,
        );
        return null;
      }

      // 校验必需字段
      const validationError = this.validateFrontmatter(frontmatter);
      if (validationError) {
        this.logger.error(
          `SKILL.md 校验失败 (${skillMdPath}): ${validationError}`,
        );
        return null;
      }

      // 扫描子目录
      const scripts = this.listDirFiles(
        path.join(skillDirPath, 'scripts'),
      );
      const references = this.listDirFiles(
        path.join(skillDirPath, 'references'),
      );
      const assets = this.listDirFiles(path.join(skillDirPath, 'assets'));

      // Skill ID 取自 frontmatter.name 或目录名
      const id = frontmatter.name || path.basename(skillDirPath);

      const parsed: ParsedSkill = {
        frontmatter,
        prompt,
        dirPath: skillDirPath,
        id,
        scripts,
        references,
        assets,
      };

      this.logger.log(
        `Skill 解析成功: ${id} — ` +
          `${scripts.length} scripts, ${references.length} references, ${assets.length} assets`,
      );

      return parsed;
    } catch (error) {
      this.logger.error(
        `Skill 解析异常 (${skillDirPath}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 解析 SKILL.md 内容：拆分 YAML frontmatter 和 Markdown 正文
   */
  private parseFrontmatterAndContent(content: string): {
    frontmatter: SkillFrontmatter | null;
    prompt: string;
  } {
    // 匹配 --- 包裹的 YAML frontmatter
    const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = content.match(fmRegex);

    if (!match) {
      return { frontmatter: null, prompt: content };
    }

    try {
      const frontmatter = yaml.load(match[1]) as SkillFrontmatter;
      const prompt = match[2].trim();
      return { frontmatter, prompt };
    } catch (error) {
      this.logger.error(
        `YAML frontmatter 解析错误: ${(error as Error).message}`,
      );
      return { frontmatter: null, prompt: '' };
    }
  }

  /**
   * 校验 frontmatter 必需字段（标准格式：只需 name + description）
   */
  private validateFrontmatter(fm: SkillFrontmatter): string | null {
    if (!fm.name || typeof fm.name !== 'string') {
      return '缺少 name 字段';
    }
    if (!/^[a-z0-9-]+$/.test(fm.name)) {
      return `name 格式错误: "${fm.name}"，只允许小写字母、数字和连字符`;
    }
    if (!fm.description || typeof fm.description !== 'string') {
      return '缺少 description 字段';
    }

    return null;
  }

  /**
   * 列出指定目录中的所有文件（非递归，过滤 .gitkeep）
   */
  private listDirFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];

    try {
      return fs
        .readdirSync(dirPath)
        .filter(
          (f) =>
            !f.startsWith('.') &&
            f !== '.gitkeep' &&
            fs.statSync(path.join(dirPath, f)).isFile(),
        );
    } catch {
      return [];
    }
  }

  /**
   * 读取 reference 文件内容
   */
  readReferenceFile(skillDirPath: string, fileName: string): string | null {
    const filePath = path.join(skillDirPath, 'references', fileName);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Reference 文件不存在: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * 读取 asset 文件内容
   */
  readAssetFile(skillDirPath: string, fileName: string): string | null {
    const filePath = path.join(skillDirPath, 'assets', fileName);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Asset 文件不存在: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  }
}
