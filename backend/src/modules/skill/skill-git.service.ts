import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { SkillParserService } from './skill-parser.service.js';
import { SkillRegistryService } from './skill-registry.service.js';

/**
 * Git Skill 安装参数
 */
export interface InstallSkillParams {
  /** Git 仓库 URL（HTTPS） */
  gitUrl: string;
  /** 分支名（默认 main） */
  branch?: string;
  /** 仓库内的 Skill 目录路径（默认为仓库根目录） */
  directory?: string;
}

/**
 * 安装结果
 */
export interface InstallSkillResult {
  success: boolean;
  skillId?: string;
  skillName?: string;
  message: string;
  installedPath?: string;
}

/**
 * Skill Git 服务
 *
 * 负责从 Git 仓库 clone 和管理远程 Skill：
 * 1. clone 指定仓库的指定分支/目录到 skills/ 目录
 * 2. 验证 clone 下来的内容是否包含有效的 SKILL.md
 * 3. 自动注册到 SkillRegistry
 * 4. 支持卸载（删除目录 + 注销注册表）
 * 5. 支持更新（git pull）
 *
 * 安全策略：
 * - 只允许 HTTPS URL（禁止 ssh://、file://、git:// 等）
 * - 仓库 URL 不允许包含用户名密码（禁止 https://user:pass@...）
 * - clone 深度为 1（--depth 1），减少下载量
 * - clone 后检查目录大小，超过 50MB 拒绝安装
 * - Skill 名称只允许 kebab-case
 */
@Injectable()
export class SkillGitService {
  private readonly logger = new Logger(SkillGitService.name);

  /** Skill 目录最大大小（50MB） */
  private static readonly MAX_SKILL_SIZE = 50 * 1024 * 1024;
  /** clone 超时（60 秒） */
  private static readonly CLONE_TIMEOUT = 60_000;

  constructor(
    private readonly parser: SkillParserService,
    private readonly registry: SkillRegistryService,
  ) {}

  /**
   * 从 Git 仓库安装 Skill
   */
  async install(params: InstallSkillParams): Promise<InstallSkillResult> {
    const { gitUrl, branch = 'main', directory } = params;

    // 1. 安全校验
    const urlCheck = this.validateGitUrl(gitUrl);
    if (urlCheck) {
      return { success: false, message: `[安全] ${urlCheck}` };
    }

    const skillsRoot = this.registry.getSkillsRootDir();
    // 使用临时目录先 clone，验证后再移动
    const tmpDir = path.join(skillsRoot, `_tmp_clone_${Date.now()}`);

    try {
      // 2. Git clone（shallow clone，只取指定分支）
      this.logger.log(
        `开始 clone: ${gitUrl} (branch=${branch}${directory ? `, dir=${directory}` : ''})`,
      );
      await this.gitClone(gitUrl, branch, tmpDir);

      // 3. 确定 SKILL.md 所在目录
      let skillSourceDir = tmpDir;
      if (directory) {
        skillSourceDir = path.join(tmpDir, directory);
        if (!fs.existsSync(skillSourceDir)) {
          return {
            success: false,
            message: `仓库中不存在指定目录: ${directory}`,
          };
        }
      }

      // 4. 验证 SKILL.md 存在且有效
      const skillMdPath = path.join(skillSourceDir, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) {
        return {
          success: false,
          message: `指定目录中未找到 SKILL.md 文件${directory ? `（目录: ${directory}）` : ''}`,
        };
      }

      // 5. 解析验证
      const parsed = this.parser.parseSkillDir(skillSourceDir);
      if (!parsed) {
        return {
          success: false,
          message: 'SKILL.md 解析失败，请检查格式是否正确',
        };
      }

      // 6. 检查大小
      const dirSize = this.getDirSize(skillSourceDir);
      if (dirSize > SkillGitService.MAX_SKILL_SIZE) {
        return {
          success: false,
          message: `Skill 目录过大 (${(dirSize / 1024 / 1024).toFixed(1)}MB)，超过限制 50MB`,
        };
      }

      // 7. 检查是否已安装同名 Skill
      const skillId = parsed.id;
      const targetDir = path.join(skillsRoot, skillId);
      if (fs.existsSync(targetDir)) {
        // 已存在 → 删除旧的
        this.logger.warn(`Skill "${skillId}" 已存在，将被覆盖`);
        fs.rmSync(targetDir, { recursive: true, force: true });
        this.registry.unregister(skillId);
      }

      // 8. 移动到正式目录
      if (directory) {
        // 只移动指定子目录
        this.copyDir(skillSourceDir, targetDir);
      } else {
        // 移动整个 clone 目录
        fs.renameSync(tmpDir, targetDir);
      }

      // 9. 写入 .git-source.json 记录来源信息
      const sourceInfo = {
        gitUrl,
        branch,
        directory: directory || null,
        installedAt: new Date().toISOString(),
      };
      fs.writeFileSync(
        path.join(targetDir, '.git-source.json'),
        JSON.stringify(sourceInfo, null, 2),
      );

      // 10. 注册到 Registry
      const registered = this.registry.load(targetDir);
      if (!registered) {
        return {
          success: false,
          message: '安装成功但注册失败，请尝试手动重载',
          installedPath: targetDir,
        };
      }

      this.logger.log(`Skill "${skillId}" 安装成功: ${targetDir}`);

      return {
        success: true,
        skillId,
        skillName: parsed.frontmatter.name,
        message: `Skill "${parsed.frontmatter.name}" 安装成功`,
        installedPath: targetDir,
      };
    } catch (error) {
      return {
        success: false,
        message: `安装失败: ${(error as Error).message}`,
      };
    } finally {
      // 清理临时目录
      if (fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // 忽略清理错误
        }
      }
    }
  }

  /**
   * 卸载（删除）已安装的 Skill
   */
  uninstall(skillId: string): { success: boolean; message: string } {
    const entry = this.registry.get(skillId);
    if (!entry) {
      return { success: false, message: `Skill "${skillId}" 未注册` };
    }

    const dirPath = entry.skill.dirPath;

    // 检查是否是 git 安装的（有 .git-source.json）
    const sourceFile = path.join(dirPath, '.git-source.json');
    if (!fs.existsSync(sourceFile)) {
      return {
        success: false,
        message: `Skill "${skillId}" 不是通过 git 安装的，不支持卸载`,
      };
    }

    try {
      // 从注册表注销
      this.registry.unregister(skillId);

      // 删除目录
      fs.rmSync(dirPath, { recursive: true, force: true });

      this.logger.log(`Skill "${skillId}" 已卸载`);
      return {
        success: true,
        message: `Skill "${skillId}" 已卸载`,
      };
    } catch (error) {
      return {
        success: false,
        message: `卸载失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 更新已安装的 Git Skill（git pull）
   */
  async update(skillId: string): Promise<InstallSkillResult> {
    const entry = this.registry.get(skillId);
    if (!entry) {
      return { success: false, message: `Skill "${skillId}" 未注册` };
    }

    const dirPath = entry.skill.dirPath;
    const sourceFile = path.join(dirPath, '.git-source.json');

    if (!fs.existsSync(sourceFile)) {
      return {
        success: false,
        message: `Skill "${skillId}" 不是通过 git 安装的，不支持更新`,
      };
    }

    try {
      const sourceInfo = JSON.parse(
        fs.readFileSync(sourceFile, 'utf-8'),
      ) as InstallSkillParams;

      // 重新安装（会自动覆盖）
      return this.install(sourceInfo);
    } catch (error) {
      return {
        success: false,
        message: `更新失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取已安装 Skill 的来源信息
   */
  getSourceInfo(
    skillId: string,
  ): (InstallSkillParams & { installedAt: string }) | null {
    const entry = this.registry.get(skillId);
    if (!entry) return null;

    const sourceFile = path.join(entry.skill.dirPath, '.git-source.json');
    if (!fs.existsSync(sourceFile)) return null;

    try {
      return JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
    } catch {
      return null;
    }
  }

  // ==================== 安全校验 ====================

  /**
   * 验证 Git URL 安全性
   */
  private validateGitUrl(url: string): string | null {
    // 只允许 HTTPS
    if (!url.startsWith('https://')) {
      return '只允许 HTTPS 协议的 Git URL';
    }

    // 禁止 URL 中包含用户名密码
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) {
        return 'Git URL 中不允许包含用户名或密码';
      }
    } catch {
      return '无效的 URL 格式';
    }

    // 基本格式检查
    if (!/^https:\/\/[\w.-]+\/[\w./-]+$/.test(url.replace(/\.git$/, ''))) {
      return 'URL 格式不合法';
    }

    return null;
  }

  // ==================== Git 操作 ====================

  /**
   * 执行 git clone（shallow clone）
   */
  private gitClone(
    url: string,
    branch: string,
    targetDir: string,
  ): Promise<void> {
    // 清洗 branch 名：只允许字母数字、连字符、下划线、斜杠、点
    if (!/^[\w./-]+$/.test(branch)) {
      return Promise.reject(new Error(`不合法的分支名: "${branch}"`));
    }

    const command = `git clone --depth 1 --branch "${branch}" "${url}" "${targetDir}"`;

    return new Promise((resolve, reject) => {
      exec(
        command,
        { timeout: SkillGitService.CLONE_TIMEOUT },
        (error, _stdout, stderr) => {
          if (error) {
            reject(
              new Error(`Git clone 失败: ${stderr?.trim() || error.message}`),
            );
            return;
          }
          resolve();
        },
      );
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 获取目录总大小（字节）
   */
  private getDirSize(dirPath: string): number {
    let totalSize = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.name === '.git') continue; // 跳过 .git 目录
      if (entry.isDirectory()) {
        totalSize += this.getDirSize(fullPath);
      } else {
        totalSize += fs.statSync(fullPath).size;
      }
    }

    return totalSize;
  }

  /**
   * 递归复制目录
   */
  private copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.name === '.git') continue; // 不复制 .git

      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
