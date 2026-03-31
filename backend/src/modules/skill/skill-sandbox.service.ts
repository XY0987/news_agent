import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { ScriptExecutionResult } from './skill.types.js';

/**
 * 沙箱安全配置
 */
export interface SandboxConfig {
  /** 脚本超时（毫秒），默认 30s */
  timeout?: number;
  /** stdout 最大字节数，默认 1MB */
  maxBuffer?: number;
  /** 允许写入的目录（相对于 skill 目录），默认 ['./tmp', './output'] */
  writableDirs?: string[];
  /** 允许读取的额外目录（skill 目录始终可读） */
  readableDirs?: string[];
  /** 额外环境变量（会被安全清洗后注入） */
  env?: Record<string, string>;
  /** 工作目录（默认为 skill 目录） */
  cwd?: string;
}

/** 默认沙箱配置 */
const DEFAULT_SANDBOX_CONFIG: Required<
  Pick<SandboxConfig, 'timeout' | 'maxBuffer' | 'writableDirs' | 'readableDirs'>
> = {
  timeout: 30_000,
  maxBuffer: 1024 * 1024,
  writableDirs: ['./tmp', './output'],
  readableDirs: [],
};

/**
 * Skill 安全沙箱服务
 *
 * 为 Skill 脚本执行提供安全约束：
 *
 * 1. **命令注入防护**：禁止 shell 元字符（; && || | > >> < $() 等）
 * 2. **路径约束**：脚本必须位于 Skill 目录内，禁止路径穿越（..）
 * 3. **环境变量清洗**：只传递白名单环境变量，不暴露系统敏感信息
 * 4. **文件操作受限**：通过环境变量 SKILL_WRITABLE_DIRS 声明可写目录
 * 5. **网络可用但有超时**：允许网络请求，但整体脚本有超时限制
 * 6. **资源限制**：超时控制 + stdout 大小限制
 * 7. **只允许白名单解释器**：仅 node/bash/npx tsx
 */
@Injectable()
export class SkillSandboxService {
  private readonly logger = new Logger(SkillSandboxService.name);

  /** 环境变量白名单 — 只允许这些 key 从 process.env 透传 */
  private static readonly ENV_WHITELIST = new Set([
    'PATH',
    'HOME',
    'USER',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'TERM',
    'NODE_ENV',
    'NODE_PATH',
    'NPM_CONFIG_PREFIX',
    'NVM_DIR',
    'NVM_BIN',
    'TMPDIR',
    'TZ',
    // Node.js 运行时必要
    'NODE_OPTIONS',
    'NODE_EXTRA_CA_CERTS',
  ]);

  /** 禁止出现在命令中的 shell 元字符（防命令注入） */
  private static readonly SHELL_METACHAR_PATTERN = /[;&|`$(){}[\]<>!#~\n\r\\]/;

  /** 允许的脚本扩展名 → 解释器映射 */
  private static readonly ALLOWED_INTERPRETERS: Record<string, string> = {
    '.js': 'node',
    '.ts': 'npx tsx',
    '.sh': 'bash',
  };

  // ==================== 公开 API ====================

  /**
   * 在沙箱中执行脚本文件
   *
   * @param scriptPath   脚本绝对路径
   * @param skillDirPath Skill 目录绝对路径
   * @param config       沙箱配置
   */
  async executeScript(
    scriptPath: string,
    skillDirPath: string,
    config: SandboxConfig = {},
  ): Promise<ScriptExecutionResult> {
    // 1. 安全校验
    const validation = this.validateScriptPath(scriptPath, skillDirPath);
    if (validation) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `[沙箱安全] ${validation}`,
        durationMs: 0,
      };
    }

    // 2. 构建安全命令
    const command = this.buildSafeCommand(scriptPath);
    if (!command) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `[沙箱安全] 不支持的脚本类型: ${path.extname(scriptPath)}`,
        durationMs: 0,
      };
    }

    // 3. 构建安全环境变量
    const safeEnv = this.buildSafeEnv(skillDirPath, config);

    // 4. 执行
    const timeout = config.timeout ?? DEFAULT_SANDBOX_CONFIG.timeout;
    const maxBuffer = config.maxBuffer ?? DEFAULT_SANDBOX_CONFIG.maxBuffer;
    const cwd = config.cwd ?? skillDirPath;

    this.logger.debug(
      `[沙箱] 执行: ${command} (cwd=${cwd}, timeout=${timeout}ms)`,
    );

    return this.execInSandbox(command, cwd, safeEnv, timeout, maxBuffer);
  }

  /**
   * 在沙箱中执行原始命令（用于 !`command` 脚本注入）
   *
   * 比 executeScript 更严格：
   * - 命令必须以白名单解释器开头
   * - 额外检查命令注入
   * - 引用的脚本文件必须在 skill 目录内
   */
  async executeCommand(
    command: string,
    skillDirPath: string,
    config: SandboxConfig = {},
  ): Promise<string> {
    // 1. 命令注入检查
    const injectionCheck = this.checkCommandInjection(command);
    if (injectionCheck) {
      throw new Error(`[沙箱安全] 命令被拒绝: ${injectionCheck}`);
    }

    // 2. 验证命令引用的文件在 skill 目录内
    const fileCheck = this.validateCommandFiles(command, skillDirPath);
    if (fileCheck) {
      throw new Error(`[沙箱安全] ${fileCheck}`);
    }

    // 3. 构建安全环境变量
    const safeEnv = this.buildSafeEnv(skillDirPath, config);

    const timeout = config.timeout ?? DEFAULT_SANDBOX_CONFIG.timeout;
    const maxBuffer = config.maxBuffer ?? DEFAULT_SANDBOX_CONFIG.maxBuffer;
    const cwd = config.cwd ?? skillDirPath;

    this.logger.debug(
      `[沙箱] 命令注入执行: ${command} (cwd=${cwd}, timeout=${timeout}ms)`,
    );

    return new Promise((resolve, reject) => {
      exec(
        command,
        { cwd, env: safeEnv, timeout, maxBuffer },
        (error, stdout, stderr) => {
          if (error) {
            const errMsg = stderr?.trim() || error.message;
            reject(new Error(`exit=${error.code ?? 1}: ${errMsg}`));
            return;
          }
          if (stderr?.trim()) {
            this.logger.debug(`[沙箱] stderr: ${stderr.trim()}`);
          }
          resolve(stdout?.trim() || '');
        },
      );
    });
  }

  // ==================== 安全校验 ====================

  /**
   * 验证脚本路径安全性
   * - 脚本必须在 skill 目录内
   * - 脚本文件必须存在
   * - 不允许路径穿越（..）
   * - 不允许符号链接指向 skill 目录外
   */
  private validateScriptPath(
    scriptPath: string,
    skillDirPath: string,
  ): string | null {
    const resolvedScript = path.resolve(scriptPath);
    const resolvedSkillDir = path.resolve(skillDirPath);

    // 路径穿越检查
    if (
      !resolvedScript.startsWith(resolvedSkillDir + path.sep) &&
      resolvedScript !== resolvedSkillDir
    ) {
      return `脚本路径 "${scriptPath}" 不在 Skill 目录内（禁止路径穿越）`;
    }

    // 文件存在性检查
    if (!fs.existsSync(resolvedScript)) {
      return `脚本不存在: ${scriptPath}`;
    }

    // 符号链接检查：确保真实路径也在 skill 目录内
    try {
      const realPath = fs.realpathSync(resolvedScript);
      if (
        !realPath.startsWith(resolvedSkillDir + path.sep) &&
        realPath !== resolvedSkillDir
      ) {
        return `脚本符号链接指向 Skill 目录外: ${realPath}`;
      }
    } catch {
      return `无法解析脚本路径: ${scriptPath}`;
    }

    // 扩展名检查
    const ext = path.extname(resolvedScript);
    if (!SkillSandboxService.ALLOWED_INTERPRETERS[ext]) {
      return `不支持的脚本扩展名: ${ext}（仅允许 .js, .ts, .sh）`;
    }

    return null;
  }

  /**
   * 命令注入检查
   * 禁止 shell 元字符，防止通过 !`command` 语法注入任意命令
   */
  private checkCommandInjection(command: string): string | null {
    if (SkillSandboxService.SHELL_METACHAR_PATTERN.test(command)) {
      return `命令包含禁止的 shell 元字符: "${command}"`;
    }

    // 检查命令是否以允许的解释器开头
    const allowedPrefixes = [
      'node ',
      'npx tsx ',
      'bash ',
      'cat ',
      'node"',
      'npx tsx"',
      'bash"',
    ];
    const trimmedCmd = command.trim();
    const isAllowed = allowedPrefixes.some((p) => trimmedCmd.startsWith(p));
    if (!isAllowed) {
      return `命令未以允许的解释器开头（允许: node, npx tsx, bash, cat）: "${trimmedCmd}"`;
    }

    return null;
  }

  /**
   * 验证命令中引用的文件路径
   * 确保 !`command` 中引用的脚本文件在 skill 目录内
   */
  private validateCommandFiles(
    command: string,
    skillDirPath: string,
  ): string | null {
    // 提取命令中的文件路径（简单启发式：空格后的第一个非选项参数）
    const parts = command.trim().split(/\s+/);
    // 跳过解释器名（可能是 "npx tsx" 两个词）
    let fileArgIndex = 1;
    if (parts[0] === 'npx' && parts[1] === 'tsx') {
      fileArgIndex = 2;
    }

    const filePath = parts[fileArgIndex];
    if (!filePath) return null;

    // 去除引号
    const cleanPath = filePath.replace(/^["']|["']$/g, '');
    const resolvedPath = path.resolve(skillDirPath, cleanPath);
    const resolvedSkillDir = path.resolve(skillDirPath);

    if (
      !resolvedPath.startsWith(resolvedSkillDir + path.sep) &&
      resolvedPath !== resolvedSkillDir
    ) {
      return `命令引用了 Skill 目录外的文件: "${cleanPath}"`;
    }

    return null;
  }

  // ==================== 安全环境构建 ====================

  /**
   * 构建安全的环境变量
   *
   * 策略：
   * 1. 从 process.env 中只透传白名单变量
   * 2. 注入 SKILL 相关上下文变量
   * 3. 注入 SKILL_WRITABLE_DIRS 告知脚本可写范围
   * 4. config.env 中的变量值也会被清洗
   */
  buildSafeEnv(
    skillDirPath: string,
    config: SandboxConfig = {},
  ): Record<string, string> {
    const safeEnv: Record<string, string> = {};

    // 1. 从 process.env 中只透传白名单
    for (const key of SkillSandboxService.ENV_WHITELIST) {
      if (process.env[key]) {
        safeEnv[key] = process.env[key]!;
      }
    }

    // 2. 注入可写目录信息
    const writableDirs = (
      config.writableDirs ?? DEFAULT_SANDBOX_CONFIG.writableDirs
    ).map((d) => path.resolve(skillDirPath, d));

    // 确保 tmp 和 output 目录存在
    for (const dir of writableDirs) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {
          // 忽略创建失败
        }
      }
    }

    safeEnv.SKILL_WRITABLE_DIRS = writableDirs.join(':');
    safeEnv.SKILL_ROOT_DIR = path.resolve(skillDirPath);

    // 3. 注入用户自定义环境变量（清洗值）
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        // 清洗：限制 key 只允许字母数字下划线，value 不允许换行
        if (/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
          safeEnv[key] = String(value).replace(/[\n\r]/g, ' ');
        } else {
          this.logger.warn(`[沙箱] 忽略非法环境变量名: "${key}"`);
        }
      }
    }

    return safeEnv;
  }

  // ==================== 执行引擎 ====================

  /**
   * 根据脚本扩展名构建安全的执行命令
   */
  private buildSafeCommand(scriptPath: string): string | null {
    const ext = path.extname(scriptPath);
    const interpreter = SkillSandboxService.ALLOWED_INTERPRETERS[ext];
    if (!interpreter) return null;

    const resolved = path.resolve(scriptPath);
    return `${interpreter} "${resolved}"`;
  }

  /**
   * 在沙箱约束下执行命令
   */
  private execInSandbox(
    command: string,
    cwd: string,
    env: Record<string, string>,
    timeout: number,
    maxBuffer: number,
  ): Promise<ScriptExecutionResult> {
    const startTime = Date.now();

    return new Promise<ScriptExecutionResult>((resolve) => {
      exec(
        command,
        { cwd, env, timeout, maxBuffer },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;

          if (error) {
            this.logger.warn(
              `[沙箱] 脚本执行异常 (${durationMs}ms): ${error.message}`,
            );
            resolve({
              exitCode: error.code ?? 1,
              stdout: stdout || '',
              stderr: stderr || error.message,
              durationMs,
            });
            return;
          }

          resolve({
            exitCode: 0,
            stdout: stdout || '',
            stderr: stderr || '',
            durationMs,
          });
        },
      );
    });
  }
}
