# News Agent — Skills 功能支持方案

> 版本：v1.0 | 日期：2026-03-28 | 状态：方案设计阶段

---

## 目录

1. [为什么需要 Skills](#1-为什么需要-skills)
2. [核心概念：Skills 是什么、不是什么](#2-核心概念skills-是什么不是什么)
3. [现有架构分析与扩展切入点](#3-现有架构分析与扩展切入点)
4. [Skills 架构设计](#4-skills-架构设计)
5. [Skill 标准结构定义](#5-skill-标准结构定义)
6. [Skill 生命周期](#6-skill-生命周期)
7. [SkillRegistry 设计](#7-skillregistry-设计)
8. [Agent Loop 适配方案](#8-agent-loop-适配方案)
9. [新增 Skill 示例](#9-新增-skill-示例)
10. [自定义 Skill 开发规范](#10-自定义-skill-开发规范)
11. [前端 Skills 管理设计](#11-前端-skills-管理设计)
12. [数据库扩展](#12-数据库扩展)
13. [安全与治理](#13-安全与治理)
14. [实施路线图](#14-实施路线图)
15. [附录](#附录)

---

## 1. 为什么需要 Skills

### 1.1 现状与扩展需求

当前 News Agent 已具备完整的核心能力：

| 现有能力 | 说明 |
|---------|------|
| **3 种运行模式** | 每日精选 / GitHub 热点 / 深度分析，覆盖核心使用场景 |
| **16 个 Tools** | 感知类（4）+ 行动类（7）+ 推送类（2）+ 记忆类（3），工具体系完备 |
| **Agent Loop** | 基于 OpenAI Function Calling 的自建循环，支持重试、Token 管理、兜底安全网 |
| **定时调度** | Scheduler 按用户偏好时间触发，运行稳定 |

**现有流程运行良好，不需要改动。** 但随着项目演进，有以下增量扩展需求：

| 需求 | 说明 |
|------|------|
| **新场景扩展** | 用户希望增加更多能力（如"微信公众号定时监控""周报自动生成""特定主题追踪"等），目前每增加一种能力都需要在 `agent.service.ts` 中新写一套入口方法和 Prompt |
| **领域知识积累** | 不同场景有不同的专业 Prompt 和工具组合逻辑，缺少标准化的封装方式 |
| **用户自定义** | 高级用户希望能定义自己的信息处理流程，而不局限于系统预设的 3 种模式 |
| **插拔式管理** | 希望能通过配置（而非改代码）来添加、启用、禁用某种 Agent 能力 |

### 1.2 Skills 的定位

**Skills 是在现有 Agent 体系之上的增量扩展层**，用于支持全新的能力，而非替换或改造现有功能：

- 现有的 `runDailyDigest` / `runGithubTrending` / `runAnalysisOnly` **保持原样不动**
- 现有的 16 个 Tools 和 `AgentToolRegistry` **保持原样不动**
- Skills 是一条**独立的新通道**：通过声明式定义（`SKILL.md`）配置新的 Agent 能力
- Skills 复用现有的 `runAgentLoop()` 和 `AgentToolRegistry`，但不影响现有调用链
- 将来如果需要新增能力（如"微信公众号监控""AI 周报""竞品追踪"等），用 Skill 来实现，无需改动已有代码

---

## 2. 核心概念：Skills 是什么、不是什么

### 2.1 概念定义

**Skill 是对 Agent 特定领域能力的标准化封装**——它不是一个函数调用（那是 Tool），也不是一个连接协议（那是 MCP），而是一个包含了"在什么情况下、用什么知识、调用哪些工具、按什么流程、产出什么结果"的**完整能力单元**。

用一个类比来说明：

> 如果 Agent 是一个人——
> - **Tool** 是他手里的螺丝刀、扳手（单个可调用的函数）
> - **MCP** 是一套标准化的工具接口协议（让不同品牌的工具都能通用）
> - **Skill** 是他掌握的"修理空调"技能（知道什么时候需要修、先检查什么、用哪些工具、按什么顺序、修到什么程度算完）

### 2.2 Skills vs Tools vs MCP 三者关系

```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│  ★ 新增 Skill 层（增量扩展）                                  │
│  "微信监控 Skill"  "AI周报 Skill"  "竞品追踪 Skill"  ...     │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│   │ SKILL.md │     │ SKILL.md │     │ SKILL.md │          │
│   │ scripts/ │     │ scripts/ │     │ scripts/ │          │
│   │ refs/    │     │ refs/    │     │ refs/    │          │
│   │ tools[]  │     │ tools[]  │     │ tools[]  │          │
│   └────┬─────┘     └────┬─────┘     └────┬─────┘          │
│        │                │                │                  │
│        └───────────┬────┴────────────────┘                  │
│                    │                                        │
├────────────────────┼────────────────────────────────────────┤
│                    ▼                  Tool 层               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │fetch_rss │  │search_gh │  │send_mail │ ... (现有16个)   │
│  │(function)│  │(function)│  │(function)│                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│        │                │           │                      │
├────────┼────────────────┼───────────┼──────────────────────┤
│        ▼                ▼           ▼      协议层          │
│     OpenAI Function Calling / MCP Protocol                 │
└────────────────────────────────────────────────────────────┘

注意：现有的 3 种运行模式（每日精选/GitHub热点/深度分析）不在 Skill 层中，
     它们保持原有的直接调用方式不变。Skill 层只用于新增能力。
```

**关键区别**：

| 维度 | Tool | MCP | Skill |
|------|------|-----|-------|
| **抽象层级** | 最底层，单个函数 | 中间层，连接协议 | 最高层，能力封装 |
| **包含内容** | 函数签名 + 实现 | 传输协议 + 工具发现 | Prompt + 工具编排 + 触发条件 + 领域知识 |
| **粒度** | 细粒度（一个操作） | 中粒度（一组工具的暴露方式） | 粗粒度（一个完整任务） |
| **谁定义** | 开发者 | 协议规范 | 开发者 / 高级用户 / 社区 |
| **热插拔** | 通常需要改代码 | 通过协议发现 | 通过配置文件加载 |
| **类比** | 螺丝刀 | USB 接口标准 | "修空调"技能 |

### 2.3 Skill 的核心设计哲学

**"模型不应永远记住一切，而应在需要时精准加载所需"**

这意味着：
- Agent 在空闲状态时不需要知道所有 Skill 的详细 Prompt 和工具列表
- 当触发条件满足时，Agent 动态加载对应 Skill 的完整上下文（Prompt、工具、知识）
- Skill 执行完毕后，其上下文可以卸载，减少 Token 消耗
- 每个 Skill 是自包含的，拥有完整的"如何做好这件事"的知识

---

## 3. 现有架构分析与扩展切入点

### 3.1 现有 Agent 架构关键组件

```
                  用户请求 / 定时触发
                         │
                         ▼
               ┌─────────────────────┐
               │  AgentController    │  API 入口（run / run-github / analyze）
               └────────┬────────────┘
                         │
                         ▼
               ┌─────────────────────┐
               │  AgentService       │  核心编排层
               │  ├─ runDailyDigest  │  硬编码的3种模式
               │  ├─ runGithubTrend  │
               │  ├─ runAnalysisOnly │
               │  └─ runAgentLoop()  │  ← 通用 Agent 循环（maxSteps=25）
               └────────┬────────────┘
                         │
                ┌────────┴────────┐
                ▼                 ▼
    ┌──────────────────┐  ┌──────────────┐
    │ AgentToolRegistry│  │  LLM Client  │
    │  16 Tools 硬编码  │  │ (OpenAI API) │
    └──────────────────┘  └──────────────┘
```

### 3.2 可复用的架构资产

现有架构中以下组件可直接复用，无需推翻重建：

| 组件 | 文件 | 复用方式 |
|------|------|----------|
| **Agent Loop** | `agent.service.ts` → `runAgentLoop()` | Skill 执行引擎直接复用，无需另写循环 |
| **Tool Registry** | `agent-tool-registry.ts` | 作为 Skill 底层的 Tool 提供者 |
| **Tool 类型定义** | `agent.types.ts` | 扩展，不替换 |
| **LLM 调用（含重试）** | `agent.service.ts` → `callLLMWithRetry()` | 所有 Skill 共用 |
| **Token 管理** | `agent.service.ts` → Token 安全网 | 所有 Skill 共用 |
| **记忆系统** | `memory.service.ts` | 作为 Skill 可调用的 Tool |
| **定时调度** | `scheduler.service.ts` | 适配为 Skill 触发器 |

### 3.3 需要新增的层

Skills 作为独立的新通道，与现有的 3 种模式**并行存在**：

```
              用户请求 / 定时触发 / 事件触发
                       │
                       ▼
             ┌─────────────────────┐
             │  AgentController    │  API 入口
             └────────┬────────────┘
                       │
         ┌─────────────┼──────────────────┐
         │             │                   │
         ▼             ▼                   ▼
 ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐
 │ 现有模式入口  │ │ 现有模式入口  │ │ ★ 新增 Skill 通道         │
 │ runDaily     │ │ runGithub    │ │                          │
 │ Digest()     │ │ Trending()   │ │  SkillRegistry           │
 │              │ │              │ │    ↓ 发现 + 加载 Skill    │
 │ runAnalysis  │ │              │ │  SkillExecutor            │
 │ Only()       │ │              │ │    ↓ 组装 AgentLoopConfig │
 │ (保持不变)    │ │ (保持不变)    │ │    ↓                     │
 └──────┬───────┘ └──────┬───────┘ └──────────┬───────────────┘
         │              │                      │
         └──────────────┼──────────────────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │  AgentService       │  核心不变
             │  └─ runAgentLoop() │  ← 所有通道最终都调用这个方法
             └────────┬────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
  ┌──────────────────┐  ┌──────────────┐
  │ AgentToolRegistry│  │  LLM Client  │
  │ (现有 16 Tools)   │  │  (现有)       │
  └──────────────────┘  └──────────────┘
```

**核心设计原则：Skills 是一条独立的新能力扩展通道，与现有的 3 种运行模式并行运行，共享底层的 Agent Loop、Tool Registry 和 LLM Client，互不干扰。**

---

## 4. Skills 架构设计

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Skills 管理层                              │
│                                                                   │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │ Skill Store │  │ Skill Resolver │  │ Skill Lifecycle Mgr │   │
│  │ (存储/加载)  │  │ (触发匹配)     │  │ (安装/启用/禁用)      │   │
│  └──────┬──────┘  └───────┬────────┘  └──────────┬───────────┘   │
│         │                 │                       │               │
│         └────────────┬────┴───────────────────────┘               │
│                      ▼                                            │
│           ┌─────────────────────┐                                 │
│           │   Skill Registry    │ ← 核心注册表                     │
│           └────────┬────────────┘                                 │
│                    │                                              │
├────────────────────┼──────────────────────────────────────────────┤
│                    ▼              Skills 执行层                    │
│         ┌─────────────────────┐                                   │
│         │  Skill Executor     │                                   │
│         │  ┌───────────────┐  │                                   │
│         │  │ Context Build │  │ ← 组装 System Prompt              │
│         │  │ Tool Select   │  │ ← 从 ToolRegistry 筛选工具子集     │
│         │  │ Config Assemble│ │ ← 生成 AgentLoopConfig            │
│         │  └───────────────┘  │                                   │
│         └────────┬────────────┘                                   │
│                  │                                                │
├──────────────────┼────────────────────────────────────────────────┤
│                  ▼              现有 Agent 层（不改动）              │
│         ┌─────────────────────┐                                   │
│         │  Agent Loop         │ ← runAgentLoop(config)            │
│         │  Tool Registry      │ ← 16 Tools（感知/行动/推送/记忆）   │
│         │  LLM Client         │ ← callLLMWithRetry()              │
│         │  Memory System      │ ← memory.service                  │
│         └─────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| Skill 定义格式 | SKILL.md（YAML frontmatter + Markdown 正文）| frontmatter 只含 name + description（对标 CodeBuddy/Cursor/Claude Code 标准），工具列表和执行步骤等全部写在 Markdown 正文中 |
| Skill 存储位置 | 文件系统 `skills/` 目录 + 数据库元数据 | 文件系统方便版本管理（Git），数据库存运行状态 |
| Skill 发现机制 | 启动时扫描 + 运行时热加载 | 兼顾性能和灵活性 |
| Skill 与现有模式的关系 | **并行独立 + 自动注入**，不改造现有模式 | 现有流程稳定可靠，Skills 通过 name + description 注入现有流程的 systemPrompt，AI 自行判断是否运用 |
| Tool 复用方式 | Skill 通过名称引用 ToolRegistry 中的现有 Tool | 不重新定义 Tool，只组合编排 |
| Prompt 管理 | 在 SKILL.md Markdown 正文中直接编写，支持变量插值 | 元数据和 Prompt 同文件，版本管理更简单 |
| 确定性逻辑 | 放在 `scripts/` 中作为可执行脚本 | LLM 不擅长的确定性操作（去重、统计）交给代码执行 |
| 领域知识 | 放在 `references/` 中，支持预加载/按需加载 | 避免大量文档一次性塞满上下文窗口，节省 Token |

### 4.3 Skill 增强机制：AI 自主判断

Skill 不仅可以通过 `runSkill()` 独立运行，还会**自动注入到现有流程**（每日精选、GitHub 热点、深度分析等）中：

**工作原理**：
1. 用户在前端启用了某个 Skill
2. 现有流程（如 `runDailyDigest`）执行时，调用 `SkillEnhancerService.enhance()`
3. `enhance()` 查找该用户**所有已启用的 Skill**，将每个 Skill 的 `name` + `description` 以清单形式追加到 systemPrompt 末尾
4. AI 看到这些 Skill 描述后，**自行判断**当前任务是否需要运用某个 Skill 的能力——就像 AI 看到 tool 列表后自己决定是否调用某个 tool

**关键设计原则**：
- **Skill 不声明自己"增强哪个流程"**：没有 `enhances` 字段，Skill 的 frontmatter 保持标准的 `name` + `description`
- **AI 自主决策**：注入的是 Skill 的能力描述，由 AI 根据当前任务上下文判断是否相关
- **零侵入**：如果用户未启用任何 Skill，`enhance()` 直接透传原始 prompt，现有流程完全不受影响
- **统一注入**：所有现有流程入口方法都调用同一个 `enhance()`，不需要按流程类型区分

```
现有流程执行时的 Skill 注入流程：

runDailyDigest(userId)
  │
  ├─ buildAgentSystemPrompt(user)        ← 构建原始 systemPrompt
  │
  ├─ skillEnhancer.enhance(prompt, userId)  ← 查找用户已启用的 Skill
  │   │
  │   ├─ 查注册表：获取所有可用 Skill
  │   ├─ 查数据库：过滤出用户 status=enabled 的 Skill
  │   └─ 注入每个 Skill 的 name + description 到 prompt 末尾
  │
  └─ runAgentLoop(config)                ← AI 在增强后的 prompt 中看到 Skill 清单
                                            自己决定是否运用
```

---

## 5. Skill 标准结构定义

> **对标开放标准**：本项目的 Skill 结构对标 [Agent Skills 开放标准](https://cursor.com/docs/skills)（Cursor / CodeBuddy / Claude Code / Codex 共同遵循），确保 Skill 可移植、可版本控制、可按需加载。

### 5.1 核心设计理念：一个 Skill = 一个文件夹

每个 Skill 是 `skills/` 目录下的一个子文件夹，由以下部分组成：

| 组成 | 文件/目录 | 必需 | 说明 |
|------|----------|------|------|
| **技能定义** | `SKILL.md` | ✅ 必需 | YAML frontmatter（元数据）+ Markdown 正文（Prompt 指令） |
| **可执行脚本** | `scripts/` | 可选 | 可执行代码（TS/Python/Shell），提供确定性的预处理/后处理能力 |
| **参考资料** | `references/` | 可选 | 领域文档、API 规范、评分规则等，按需加载到 Agent 上下文 |
| **静态资产** | `assets/` | 可选 | 模板文件、配置模板、邮件模板等，用于 Agent 生成输出 |

### 5.2 目录结构

```
skills/
├── wechat-monitor/               # Skill：微信公众号定时监控
│   ├── SKILL.md                  # [必需] 技能定义（元数据 + Prompt 指令）
│   ├── scripts/                  # [可选] 可执行脚本
│   │   ├── check_wechat_api.sh   #   微信接口可用性预检
│   │   └── deduplicate.ts        #   文章去重逻辑（确定性执行）
│   ├── references/               # [可选] 参考资料（按需加载）
│   │   ├── WECHAT_API.md         #   微信公众号 API 文档
│   │   └── SCORING_RULES.md      #   内容评分规则说明
│   └── assets/                   # [可选] 静态资产
│       └── email-template.html   #   通知邮件 HTML 模板
│
├── weekly-report/                # Skill：AI 周报生成
│   ├── SKILL.md
│   ├── scripts/
│   │   └── aggregate_stats.ts    #   数据聚合统计脚本
│   ├── references/
│   │   └── REPORT_FORMAT.md      #   周报格式规范
│   └── assets/
│       └── report-template.md    #   周报 Markdown 模板
│
├── topic-tracker/                # Skill：特定主题追踪
│   ├── SKILL.md
│   └── references/
│       └── NLP_KEYWORDS.md       #   关键词匹配规则
│
├── reading-digest/               # Skill：阅读笔记（最简 Skill，只需 SKILL.md）
│   └── SKILL.md
│
└── _template/                    # Skill 开发模板
    ├── SKILL.md
    ├── scripts/.gitkeep
    ├── references/.gitkeep
    └── assets/.gitkeep
```

> **注意**：现有的 3 种运行模式（每日精选、GitHub 热点、深度分析）不在 `skills/` 目录中，
> 它们保持在 `agent.service.ts` 中以原有方式运行。Skills 是独立的新扩展通道。

### 5.3 SKILL.md 文件格式

`SKILL.md` 是每个 Skill 的**唯一必需文件**，采用 **YAML frontmatter + Markdown 正文** 的格式。

> **对标 CodeBuddy / Cursor / Claude Code 开放标准**：frontmatter 只包含 `name` 和 `description` 两个必需字段，所有其他信息（工具列表、执行步骤、参数说明等）都写在 Markdown 正文中作为 Agent 指令。

```
┌─────────────────────────────────────────┐
│ --- (YAML frontmatter 开始)              │
│ name: wechat-monitor                    │  ← 技能标识（简洁）
│ description: >                          │  ← 触发描述（关键！）
│   微信公众号定时监控...                    │
│ --- (YAML frontmatter 结束)              │
│                                         │
│ # 微信公众号监控 Skill                    │  ← Markdown 正文
│                                         │    （Agent 完整指令）
│ 你是一个专业的微信公众号内容监控助手。      │
│ ## 可用工具                              │
│ | 工具 | 用途 |                          │
│ ## 执行流程                              │
│ 1. 获取监控列表...                       │
│ 2. 采集新文章...                         │
│ ## 注意事项                              │
│ ...                                     │
└─────────────────────────────────────────┘
```

#### 5.3.1 YAML Frontmatter（元数据部分）

frontmatter 用三个短横 `---` 包裹，**只包含两个必需字段**：

```yaml
---
name: wechat-monitor
description: >
  微信公众号定时监控 Skill。定时监控指定微信公众号，发现新文章后自动采集、评分、摘要，并推送通知给用户。
  当用户说"监控公众号"、"检查公众号更新"、"采集微信文章"等时触发此技能。
---
```

**字段说明**：

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | ✅ | 技能标识名，kebab-case |
| `description` | ✅ | 触发描述——**这是 AI 决定是否使用此技能的关键依据**。应包含技能功能说明和典型触发场景/关键词 |

> **重要**：`description` 是 Skill 的触发机制核心。AI 根据 `description` 判断当前任务是否需要加载此 Skill。因此 description 应该写得尽可能具体，包含典型的用户表述和使用场景。

#### 5.3.2 Markdown 正文（Agent 指令部分）

frontmatter 之后的 Markdown 正文即为 **Agent 的完整执行指令**——包含角色定义、可用工具、执行流程、参数说明、注意事项等所有信息。

正文支持 Mustache 风格的变量插值（`{{variableName}}`），由系统在执行时自动注入：

```markdown
# 微信公众号监控 Skill

你是一个专业的微信公众号内容监控 AI 助手。

## 你的用户

- 用户名：{{userName}}
- 兴趣领域：{{userInterests}}

## 可用工具

| 工具 | 用途 |
|------|------|
| `read_user_profile` | 获取用户信息和兴趣画像 |
| `fetch_wechat_articles` | 采集指定公众号的最新文章 |
| `batch_score_contents` | 批量评分 |
| ... | ... |

## 执行流程

今天是 {{currentDate}}，请执行以下工作：

1. **获取监控列表**：调用 `read_user_profile` 获取用户信息...
2. **采集新文章**：对每个公众号调用 `fetch_wechat_articles`...
3. ...

## 注意事项

- 评分低于 {{minScore|60}} 分的文章不需要生成摘要
- 单次处理文章不超过 {{maxArticles|20}} 篇

## 参考资料

如需详细了解评分规则，阅读 `references/SCORING_RULES.md`。
```

> **为什么 frontmatter 如此精简？** 对标 CodeBuddy / Cursor / Claude Code 等主流 AI IDE 的 Skill 标准：
> 1. **触发靠 description**：AI 根据 description 文本匹配决定是否加载技能，不需要复杂的 trigger 配置
> 2. **指令全在正文**：工具列表、执行步骤、参数等都写在 Markdown 正文中，作为 Agent 的 System Prompt
> 3. **最大灵活性**：Markdown 正文格式自由，可以包含任何 Agent 需要的信息
> 4. **可移植性**：标准格式的 Skill 可以在不同 AI IDE 之间共享

### 5.4 scripts/ 目录详解

`scripts/` 存放可执行脚本，为 Skill 提供**确定性的预处理和后处理能力**——将"适合代码做的事"从 LLM 中分离出来，提高可靠性和执行效率。

#### 适用场景

| 场景 | 说明 | 示例 |
|------|------|------|
| **预检查** | 执行前验证外部依赖/环境 | `check_wechat_api.sh` — 检查微信接口可用性 |
| **数据预处理** | 确定性的数据清洗/转换 | `deduplicate.ts` — 文章去重（精确匹配，不需要 LLM） |
| **数据聚合** | 统计/汇总操作 | `aggregate_stats.ts` — 周报的数据统计 |
| **结果后处理** | 格式化输出、生成文件 | `format_report.py` — 将结果格式化为 PDF |
| **安装/卸载** | 生命周期钩子 | `setup.sh` — 安装时初始化配置 |

#### 脚本约定

```
scripts/
├── setup.sh              # 特殊名称：安装时自动执行（生命周期钩子）
├── teardown.sh            # 特殊名称：卸载时自动执行（生命周期钩子）
├── pre_run.sh             # 特殊名称：每次执行前运行（预检查）
├── post_run.ts            # 特殊名称：每次执行后运行（后处理）
├── check_wechat_api.sh    # 自定义脚本（在 Prompt 中由 Agent 决定是否调用）
└── deduplicate.ts         # 自定义脚本（在 Prompt 中由 Agent 决定是否调用）
```

**命名约定**：

| 脚本名 | 触发方式 | 说明 |
|--------|----------|------|
| `setup.sh/ts` | 安装时自动执行 | 初始化配置、检查依赖 |
| `teardown.sh/ts` | 卸载时自动执行 | 清理数据、释放资源 |
| `pre_run.sh/ts` | 每次执行前自动执行 | 预检查、参数验证 |
| `post_run.sh/ts` | 每次执行后自动执行 | 结果后处理、日志记录 |
| 其他任意名称 | 在 Prompt 中引用，由 Agent 决定调用 | 自定义确定性逻辑 |

**脚本执行规则**：
- 脚本的 stdout 会被捕获并注入 Agent 上下文
- 脚本退出码非 0 时，系统根据 `pre_run` / 自定义脚本区分处理：`pre_run` 失败则中止执行
- 脚本运行在沙箱环境中，有超时限制（默认 30 秒）
- 支持 `.sh`（Shell）、`.ts`（TypeScript/Node）、`.py`（Python）

### 5.5 references/ 目录详解

`references/` 存放**领域参考文档**——这些文档不是 Prompt 的一部分，而是在 Agent 执行过程中**按需加载到上下文**中的知识库。

#### 设计理念

> 不同于直接写在 Prompt 中的指令，references 是"Agent 的参考书架"——Agent 知道有哪些参考资料，需要时才去翻阅，避免一次性塞满上下文窗口。

#### 文件格式

references 推荐使用 Markdown 格式，文件名大写，清晰表达内容主题：

```
references/
├── WECHAT_API.md          # 微信公众号 API 接口文档
├── SCORING_RULES.md       # 内容评分规则和权重说明
├── CONTENT_SCHEMA.md      # 内容数据结构定义
└── BEST_PRACTICES.md      # 该领域的最佳实践
```

#### 加载策略

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| **按需加载** | Agent 在 Prompt 中被告知有哪些 references 可用，需要时请求加载 | 默认策略，节省 Token |
| **预加载** | 在 SKILL.md frontmatter 中声明 `preload_references`，执行前全部加载 | 文档较小（< 2000 Token）且必定用到 |
| **条件加载** | 根据执行上下文动态决定加载哪些 references | 复杂 Skill，有多个分支路径 |

frontmatter 中的 references 声明方式：

```yaml
# 在 SKILL.md frontmatter 中声明
references:
  preload:                             # 预加载（每次执行都注入上下文）
    - SCORING_RULES.md
  available:                           # 按需加载（告知 Agent 可用，需要时再加载）
    - WECHAT_API.md
    - BEST_PRACTICES.md
```

#### references 文件示例

```markdown
# SCORING_RULES.md — 内容评分规则

## 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 相关性 | 40% | 内容与用户兴趣的匹配度 |
| 时效性 | 25% | 内容的新鲜度（发布时间距今） |
| 质量 | 20% | 内容的深度、原创性、可信度 |
| 来源权威性 | 15% | 发布来源的信誉和影响力 |

## 评分等级

- **90-100**：必读级别，立即推送
- **70-89**：高质量，纳入今日精选
- **50-69**：一般质量，存档但不推送
- **< 50**：低质量，过滤丢弃

## 特殊规则

- 用户明确关注的主题 +15 分加成
- 来源被用户标记为"重要"的 +10 分加成
- 内容与最近 7 天推送内容重复度 > 80% 时直接丢弃
```

### 5.6 assets/ 目录详解

`assets/` 存放**静态资产**——模板文件、配置文件、品牌素材等，供 Agent 在生成输出时引用。

#### 典型用途

```
assets/
├── email-template.html     # 通知邮件 HTML 模板
├── report-template.md      # 周报 Markdown 模板
├── digest-template.json    # 精选推送 JSON 模板
└── logo.png                # 品牌 logo（用于邮件头部）
```

#### 与 references 的区别

| 特征 | references/ | assets/ |
|------|------------|---------|
| **用途** | 提供领域知识，帮助 Agent 做决策 | 提供模板/素材，帮助 Agent 生成输出 |
| **内容类型** | Markdown 文档（API 文档、规则、规范） | 任意文件（HTML/JSON/图片/配置模板） |
| **加载方式** | 按需读取内容到 Agent 上下文 | Agent 引用路径或使用模板引擎渲染 |
| **示例** | `SCORING_RULES.md`（评分规则） | `email-template.html`（邮件模板） |

### 5.7 完整 SKILL.md 示例（wechat-monitor）

以下是一个完整的 SKILL.md 文件，对标 CodeBuddy / Cursor / Claude Code 标准 Skill 格式：

````markdown
---
name: wechat-monitor
description: >
  微信公众号定时监控 Skill。定时监控指定微信公众号，发现新文章后自动采集、评分、摘要，并推送通知给用户。
  当用户说"监控公众号"、"检查公众号更新"、"采集微信文章"、"公众号有什么新文章"等时触发此技能。
  也适用于定时调度场景：每 2 小时自动检查用户订阅的微信公众号是否有新内容。
---

# 微信公众号监控 Skill

你是一个专业的微信公众号内容监控 AI 助手。你的职责是帮助用户监控其订阅的微信公众号，发现新文章后自动采集、评分、生成摘要，并在发现高质量内容时推送通知。

## 你的用户

- 用户名：{{userName}}
- 兴趣领域：{{userInterests}}

## 可用工具

| 工具 | 用途 |
|------|------|
| `read_user_profile` | 获取用户信息和兴趣画像 |
| `get_user_sources` | 获取用户订阅的微信公众号列表 |
| `fetch_wechat_articles` | 采集指定公众号的最新文章 |
| `filter_content` | 过滤已采集过的文章（去重） |
| `batch_score_contents` | 批量评分 |
| `generate_summary` | 生成文章摘要 |
| `save_content` | 持久化保存有价值的文章 |
| `send_daily_digest` | 推送通知给用户 |
| `query_memory` | 查询历史记忆 |
| `save_memory` | 保存本次监控状态到记忆 |

## 执行流程

今天是 {{currentDate}}，请按以下步骤执行：

1. **获取监控列表**：调用 `read_user_profile` 获取用户信息，然后调用 `get_user_sources` 获取用户订阅的微信公众号列表
2. **采集新文章**：对每个公众号调用 `fetch_wechat_articles` 采集最新文章
3. **去重过滤**：使用 `filter_content` 过滤已采集过的文章
4. **智能评分**：使用 `batch_score_contents` 对新文章进行评分（评分规则参见下方）
5. **生成摘要**：对高分文章调用 `generate_summary` 生成摘要
6. **保存内容**：使用 `save_content` 持久化有价值的文章
7. **推送通知**：如果发现高质量新文章，通过 `send_daily_digest` 通知用户
8. **记录状态**：使用 `save_memory` 记录本次监控结果

## 上次监控记录

{{recentHistory|暂无历史记录}}

## 注意事项

- 与上次监控记录对比，只处理新增的文章
- 评分低于 {{minScore|60}} 分的文章不需要生成摘要
- 如果没有发现新的高价值文章，不需要推送通知，但仍需记录监控结果
- 单次处理文章不超过 {{maxArticles|20}} 篇

## 参考资料

如需详细了解微信 API 接口规范，阅读 `references/WECHAT_API.md`。
如需详细了解评分规则，阅读 `references/SCORING_RULES.md`。
````

---

## 6. Skill 生命周期

### 6.1 状态流转

```
                    安装
  [未安装] ──────────────────► [已安装/未启用]
                                    │
                           启用     │     禁用
                    ┌───────────────┤◄────────────────┐
                    ▼               │                  │
               [已启用]  ───────────┘            [已禁用]
                    │
           触发（定时/手动/事件）
                    │
                    ▼
              [执行中] ─────► [执行完成] ─────► [回到已启用]
                    │
                    └─────► [执行失败] ─────► [回到已启用]
                                  │
                         (连续失败3次)
                                  │
                                  ▼
                            [自动禁用]
```

### 6.2 生命周期钩子（基于 scripts/ 约定命名）

生命周期钩子通过 `scripts/` 目录中的**约定命名脚本**实现（而非在配置文件中声明），遵循"约定优于配置"原则：

| 脚本名 | 触发时机 | 用途 |
|--------|----------|------|
| `scripts/setup.sh\|ts` | Skill 被安装时 | 初始化配置、检查依赖 |
| `scripts/teardown.sh\|ts` | Skill 被卸载时 | 清理数据、释放资源 |
| `scripts/pre_run.sh\|ts` | 每次执行前 | 预检查、参数验证、环境就绪检查 |
| `scripts/post_run.sh\|ts` | 每次执行后 | 结果后处理、日志记录、数据清理 |

> **设计原则**：钩子脚本放在 `scripts/` 目录中以约定名称自动发现，无需在 `SKILL.md` 中显式声明。如果脚本不存在则跳过该钩子。
>
> 与旧方案的区别：不再在 SKILL.md frontmatter 中声明 `onInstall`/`onEnable` 等字段，而是直接在 `scripts/` 中放约定命名的可执行脚本，更灵活、可测试、可版本控制。

**钩子执行规则**：

```
安装 Skill
  └─ 存在 scripts/setup.sh? → 执行 → 失败则中止安装
  
卸载 Skill
  └─ 存在 scripts/teardown.sh? → 执行 → 失败仅记录警告
  
执行 Skill
  ├─ 1. 存在 scripts/pre_run.sh? → 执行 → 失败则中止本次执行
  ├─ 2. 解析 SKILL.md → 构建 AgentLoopConfig → 运行 Agent Loop
  └─ 3. 存在 scripts/post_run.sh? → 执行 → 失败仅记录警告
```

---

## 7. SkillRegistry 设计

### 7.1 核心职责

```
SkillRegistry
├── discover()          # 扫描 skills/ 目录，发现所有含 SKILL.md 的子目录
├── load(skillId)       # 加载并解析 SKILL.md（frontmatter + Markdown 正文）
├── validate(skill)     # 验证 frontmatter 格式、引用的 Tool 是否存在、scripts/ 权限等
├── register(skill)     # 注册到内存注册表
├── unregister(skillId) # 从注册表移除
├── get(skillId)        # 获取已注册的 Skill（含 prompt、references 列表、scripts 列表）
├── list(filters?)      # 列出所有 Skill（支持按 category/tags/status 筛选）
├── resolve(trigger)    # 根据触发条件匹配 Skill
├── reload(skillId?)    # 热重载（单个或全部）
└── getStatus(skillId)  # 获取 Skill 运行状态
```

### 7.2 与现有 AgentToolRegistry 的协作关系

```
┌──────────────────────────────────────────────────────┐
│                   SkillRegistry                       │
│                                                       │
│  skills = {                                          │
│    "wechat-monitor": {                               │
│       name: "wechat-monitor",                        │  ← SKILL.md
│       description: "微信公众号定时监控...",            │    frontmatter
│       prompt: "你是一个专业的...",                     │  ← Markdown 正文
│       scripts: ["pre_run.sh", "deduplicate.ts"],     │  ← scripts/
│       references: ["SCORING_RULES.md", "WECHAT_API"] │  ← references/
│    },                                                │
│    "weekly-report": { ... },                         │
│    "topic-tracker": { ... },                         │
│  }                                                   │
└──────────────────────────────────────────────────────┘
```

**协作模式**：SkillRegistry 解析 `SKILL.md` 的 frontmatter 获取 `name` 和 `description`（用于触发匹配），解析 Markdown 正文获取 Agent 指令（Prompt）。Prompt 中引用的工具名称由 SkillExecutor 提取，与 AgentToolRegistry 中的工具进行匹配。同时加载 `scripts/` 中的钩子脚本和 `references/` 中的参考资料。

### 7.3 Skill 解析（Resolve）流程

当系统需要决定"执行哪个 Skill"时的匹配逻辑：

```
输入：triggerContext = { type, payload }
  │
  ▼
遍历所有已启用的 Skills
  │
  ├─ type == "schedule" ?
  │     └─ 匹配当前时间与 Skill 的 schedule 配置
  │
  ├─ type == "manual" ?
  │     └─ 直接按 skillId 查找
  │
  ├─ type == "event" ?
  │     └─ 匹配事件名 + 评估 condition 表达式
  │
  └─ type == "keyword" ?
        └─ 匹配用户输入与 Skill 的 keyword patterns
  │
  ▼
返回匹配到的 Skill（可能为多个 → 按优先级排序）
```

---

## 8. Agent Loop 适配方案

### 8.1 核心思路

**不修改 `runAgentLoop()` 的内部逻辑**，只改变"谁来构造 config 参数传给它"。

当前 `runAgentLoop` 接受的 config 结构（来自 `agent.service.ts`）：

```typescript
interface AgentLoopConfig {
  systemPrompt: string;
  tools: OpenAIToolDefinition[];
  toolExecutors: Map<string, ToolExecutor>;
  maxSteps: number;
  userId: string;
  sessionId: string;
  mode: string;
}
```

### 8.2 适配方案

引入 `SkillExecutor`，其职责是将 SKILL.md 解析结果转换为 `AgentLoopConfig`：

```
SKILL.md + scripts/ + references/
       │
       ▼
 SkillExecutor.buildConfig(skill, user, params)
       │
       ├─ 1. 解析 SKILL.md → frontmatter（元数据）+ Markdown 正文（Prompt）
       │
       ├─ 2. 对 Prompt 进行变量插值（{{userName}} 等）→ systemPrompt
       │
       ├─ 3. 加载 references/preload 中声明的参考文档，追加到 systemPrompt
       │
       ├─ 4. 如果存在 scripts/pre_run.sh → 执行预检查脚本
       │     └─ 将 stdout 注入上下文（如环境状态信息）
       │
       ├─ 5. 根据 frontmatter.tools.include/exclude，
       │     从 AgentToolRegistry 中筛选 → tools[] + toolExecutors
       │
       ├─ 6. 将 scripts/ 中的自定义脚本注册为额外 Tool
       │     （Agent 可在 Prompt 指导下决定是否调用）
       │
       ├─ 7. 从 frontmatter.agent 读取 maxSteps/model/temperature
       │
       └─ 8. 组装为 AgentLoopConfig
              │
              ▼
       runAgentLoop(config)  ← 现有方法，一行不改
              │
              ▼
       存在 scripts/post_run.sh? → 执行后处理脚本
```

### 8.3 新增入口方法

在 `AgentService` 中**新增**一个通用的 Skill 执行方法，与现有的 3 个方法**并列**：

```
AgentService 方法列表：
├── runDailyDigest(userId)        ← 现有，保持不动
├── runGithubTrending(userId)     ← 现有，保持不动
├── runAnalysisOnly(userId, ...)  ← 现有，保持不动
│
└── ★ runSkill(skillId, userId, params)  ← 新增，通用 Skill 执行入口
       │
       ├─ skill = SkillRegistry.get(skillId)       // 获取已解析的 Skill
       ├─ 执行 scripts/pre_run.sh（如存在）          // 生命周期钩子
       ├─ config = SkillExecutor.buildConfig(...)    // 构建 Agent 配置
       │   ├─ 解析 SKILL.md frontmatter + Markdown 正文
       │   ├─ 变量插值 → systemPrompt
       │   ├─ 加载 references/preload → 追加到上下文
       │   └─ 筛选 Tools + 注册自定义 scripts 为 Tool
       ├─ result = runAgentLoop(config)              // 复用现有核心循环
       ├─ 执行 scripts/post_run.sh（如存在）          // 后处理钩子
       └─ return result
```

**关键原则**：
- 现有的 3 个入口方法**完全不动**，它们继续以原有方式运行
- `runSkill()` 是一个独立的新方法，只为 Skill 机制服务
- 两条路径最终都复用同一个 `runAgentLoop()` 核心循环

---

## 9. 新增 Skill 示例

> 以下示例展示了几种典型的新 Skill，它们都是**全新能力**，与现有的 3 种运行模式互不干扰。

### 9.1 可规划的新 Skill 清单

| Skill | 触发方式 | 功能说明 | 复杂度 |
|-------|----------|---------|--------|
| `wechat-monitor` | schedule（每 2 小时）| 定时监控微信公众号，发现新文章自动采集评分推送 | 中 |
| `weekly-report` | schedule（每周一 09:00）| 汇总过去一周的内容数据，生成周报并推送 | 中 |
| `topic-tracker` | event + manual | 追踪用户关注的特定主题，有新动态时通知 | 中 |
| `competitor-watch` | schedule（每天）| 监控竞品/同行的公开信息源，汇总变化 | 高 |
| `reading-digest` | manual | 用户手动输入一批 URL，批量摘要评分后生成阅读笔记 | 低 |
| `trending-alert` | event（热度突增）| 检测到某领域热点事件突增时，实时推送预警 | 高 |

### 9.2 weekly-report Skill 示例

**目录结构：**
```
skills/weekly-report/
├── SKILL.md                    # 技能定义
├── scripts/
│   └── aggregate_stats.ts      # 数据聚合统计（确定性执行）
├── references/
│   └── REPORT_FORMAT.md        # 周报格式规范
└── assets/
    └── report-template.md      # 周报 Markdown 模板
```

**SKILL.md 完整内容：**

````markdown
---
name: weekly-report
description: >
  AI 周报生成 Skill。每周一自动汇总上周的内容采集、评分、推送数据，生成个性化周报并推送给用户。
  当用户说"生成周报"、"看看上周的内容总结"、"本周有什么收获"、"周报"等时触发此技能。
  也适用于定时调度场景：每周一早上 9 点自动生成。
---

# AI 周报生成 Skill

你是一个专业的数据分析和报告生成 AI 助手。

## 你的用户

- 用户名：{{userName}}

## 可用工具

| 工具 | 用途 |
|------|------|
| `read_user_profile` | 获取用户信息和兴趣画像 |
| `query_memory` | 查询上周的执行记录和推送历史 |
| `generate_summary` | 生成周度内容总结 |
| `create_digest` | 组织周报内容 |
| `send_daily_digest` | 推送周报给用户 |
| `save_memory` | 记录本次周报生成 |

## 执行流程

今天是 {{currentDate}}（周一），请生成上周的个性化周报：

1. **获取用户画像**：调用 `read_user_profile` 了解用户兴趣
2. **查询记忆**：调用 `query_memory` 获取上周的执行记录
3. **生成总结**：用 `generate_summary` 生成周度内容总结
4. **组织周报**：参照 `references/REPORT_FORMAT.md` 的格式规范，用 `create_digest` 组织周报
5. **推送周报**：用 `send_daily_digest` 推送周报邮件
6. **记录结果**：用 `save_memory` 记录本次周报生成

## 上周数据概览

{{weekSummary|暂无上周数据}}

## 注意事项

- 周报应包含：采集统计、推送统计、热门内容 Top 5、用户反馈汇总
- 风格设置为 {{reportStyle|brief}}
- 如果上周没有任何数据，仍然生成一份简短的周报说明情况

## 参考资料

如需详细了解周报格式规范，阅读 `references/REPORT_FORMAT.md`。
````

### 9.3 topic-tracker Skill 示例

**目录结构：**
```
skills/topic-tracker/
├── SKILL.md
└── references/
    └── NLP_KEYWORDS.md            # 关键词匹配策略文档
```

**SKILL.md 完整内容：**

````markdown
---
name: topic-tracker
description: >
  主题追踪 Skill。追踪用户关注的特定主题关键词，从多个信息源（RSS、微信公众号、GitHub）中
  监控相关内容并生成汇总。当用户说"追踪这个主题"、"关注某个话题"、"监控某个关键词"、
  "有没有关于 XXX 的新消息"、"帮我盯着 XXX 方面的动态"等时触发此技能。
---

# 主题追踪 Skill

你是一个专业的主题追踪 AI 助手。

## 你的用户

- 用户名：{{userName}}

## 可用工具

| 工具 | 用途 |
|------|------|
| `read_user_profile` | 获取用户信息和兴趣画像 |
| `get_user_sources` | 获取用户订阅的信息源 |
| `fetch_rss_content` | 从 RSS 源采集内容 |
| `fetch_wechat_articles` | 从微信公众号采集内容 |
| `fetch_github_trending` | 从 GitHub 采集内容 |
| `filter_content` | 按关键词过滤内容 |
| `score_content` | 对内容评分 |
| `generate_summary` | 生成摘要 |
| `save_content` | 保存内容 |
| `query_memory` | 查询历史追踪记录 |
| `save_memory` | 保存追踪结果到记忆 |

## 追踪任务

今天是 {{currentDate}}，用户希望追踪以下主题：**{{topics}}**

请执行以下步骤：

1. **获取用户画像和订阅源**：调用 `read_user_profile` 和 `get_user_sources`
2. **从各信息源采集内容**（RSS / 微信 / GitHub 等）
3. **主题过滤**：使用 `filter_content` 按关键词过滤（可参考 `references/NLP_KEYWORDS.md` 中的匹配策略）
4. **评分排序**：对相关内容进行评分
5. **生成摘要**：对高分内容生成摘要
6. **保存并记录**：保存结果到系统并记录到记忆

## 上次追踪结果

{{previousResults|暂无历史追踪结果}}

## 注意事项

- 相关度低于 {{minRelevance|70}} 的内容直接过滤
- 最多返回 {{maxResults|15}} 条结果

## 参考资料

如需详细了解 NLP 关键词匹配策略，阅读 `references/NLP_KEYWORDS.md`。
````

### 9.4 reading-digest Skill 示例（最简 Skill —— 只需一个 SKILL.md）

**目录结构：**
```
skills/reading-digest/
└── SKILL.md                    # 仅此一个文件，无需 scripts/references/assets
```

> 这个示例展示了 Skill 的**最小形态**：只需要一个 `SKILL.md` 文件即可构成完整的 Skill。

**SKILL.md 完整内容：**

````markdown
---
name: reading-digest
description: >
  阅读笔记生成 Skill。用户提供一批文章 URL，自动抓取内容、评分、生成结构化的阅读笔记。
  当用户说"帮我读这几篇文章"、"总结一下这些链接"、"生成阅读笔记"、"批量阅读"、
  "帮我看看这些文章值不值得读"等时触发此技能。
---

# 阅读笔记 Skill

你是一个专业的阅读助手。用户提供了一批文章 URL，请依次：

1. **获取用户画像**：调用 `read_user_profile` 了解其兴趣偏好
2. **抓取内容**：通过 `fetch_rss_content` 抓取每个 URL 的内容
3. **智能评分**：对每篇内容调用 `score_content` 进行评分
4. **生成摘要**：为每篇文章调用 `generate_summary` 生成摘要
5. **保存内容**：将所有内容通过 `save_content` 持久化

最后输出一份结构化的**阅读笔记**，格式如下：

## 阅读笔记 — {{currentDate}}

### 1. [文章标题](URL)
- **评分**: XX/100
- **核心观点**: ...
- **阅读建议**: ...

### 2. [文章标题](URL)
...

> 注意：按评分从高到低排列，每篇不超过 200 字摘要。
````

---

## 10. 自定义 Skill 开发规范

### 10.1 开发流程

```
1. 复制模板    cp -r skills/_template skills/my-skill
2. 编写定义    vim skills/my-skill/SKILL.md          # frontmatter + Prompt
3. 添加脚本    vim skills/my-skill/scripts/xxx.ts     # (可选) 确定性逻辑
4. 添加参考    vim skills/my-skill/references/xxx.md  # (可选) 领域文档
5. 添加资产    cp template.html skills/my-skill/assets/ # (可选) 模板文件
6. 验证格式    npm run skill:validate my-skill
7. 本地测试    npm run skill:test my-skill --userId=xxx
8. 启用 Skill   在前端管理页面启用，或调用 API
```

### 10.2 开发模板

**`skills/_template/` 目录结构：**

```
skills/_template/
├── SKILL.md                    # 技能定义模板
├── scripts/.gitkeep            # 脚本目录占位
├── references/.gitkeep         # 参考资料目录占位
└── assets/.gitkeep             # 静态资产目录占位
```

**`skills/_template/SKILL.md` 模板内容：**

````markdown
---
name: my-custom-skill
description: >
  在这里描述你的 Skill 做什么，以及什么场景下应该触发它。
  描述应该尽可能具体，包含触发关键词和使用场景。
---

# 我的自定义技能

> 在此编写 Agent 的指令。

你是一个...（描述 Agent 的角色和职责）

## 可用工具

列出此 Skill 需要使用的工具：

| 工具 | 用途 |
|------|------|
| `tool_name` | 工具用途说明 |

## 执行流程

请按以下步骤执行：

1. 第一步...
2. 第二步...
3. 第三步...

## 注意事项

- ...
- ...

## 参考资料

如有 `references/` 目录中的参考文档，在这里说明何时需要阅读它们。
````

### 10.3 Skill 开发守则

| # | 守则 | 说明 |
|---|------|------|
| 1 | **一个 Skill 一个目标** | 每个 Skill 应该完成一个明确的任务，不要让一个 Skill 做太多事 |
| 2 | **SKILL.md 是唯一入口** | 所有元数据和 Prompt 都在 `SKILL.md` 中，不要在其他文件中重复定义 |
| 3 | **Prompt 是灵魂** | Skill 的核心价值在于 Markdown 正文中封装的领域知识，花时间打磨 Prompt |
| 4 | **只引用已有 Tool** | 不要在 Skill 中定义新 Tool，如需新工具应先在 ToolRegistry 中注册 |
| 5 | **确定性逻辑放 scripts/** | 不需要 LLM 推理的逻辑（去重、统计、格式化）放到 `scripts/` 中作为可执行脚本 |
| 6 | **领域知识放 references/** | API 文档、评分规则、格式规范等放到 `references/` 中，在 frontmatter 中声明加载策略 |
| 7 | **模板和素材放 assets/** | 邮件模板、报告模板等放到 `assets/` 中，在 Prompt 中引用路径 |
| 8 | **控制 maxSteps** | 根据任务复杂度合理设置循环步数上限，避免无限循环 |
| 9 | **定义 settings** | 将用户可能想调整的参数暴露为 settings，而非硬编码 |
| 10 | **最简优先** | 最简单的 Skill 只需一个 `SKILL.md`，不要为了"看起来完整"而创建空的 scripts/references/assets 目录 |

### 10.4 SKILL.md 编写最佳实践

#### Frontmatter 部分

```yaml
# ✅ 标准 frontmatter（只需 name + description）
---
name: my-skill                    # kebab-case，全局唯一
description: >                    # 详细描述：做什么 + 什么时候触发
  监控微信公众号，自动采集评分并推送。
  当用户说"监控公众号"、"检查更新"等时触发。
---
```

#### Markdown 正文（Prompt）部分

```markdown
# 技能名称                          ← 1. 标题（必须）

你是一个专业的...                   ← 2. 角色定义（必须）

## 你的用户                         ← 3. 用户上下文（推荐）
- 用户名：{{userName}}
- 兴趣：{{userInterests}}

## 可用工具                         ← 4. 工具列表（推荐，表格形式）
| 工具 | 用途 |
|------|------|
| `tool_name` | 做什么 |

## 执行流程                         ← 5. 任务步骤（必须，用编号列表）
1. 调用 `tool_name` 做 XXX
2. 如需精确去重，运行 `scripts/deduplicate.ts`
3. 评分时参考 `references/SCORING_RULES.md`

## 上下文信息                       ← 6. 动态变量注入（推荐）
{{previousResults}}

## 注意事项                         ← 7. 约束和边界条件（推荐）
- 单次最多处理 {{maxArticles}} 篇
- 评分低于 {{minScore}} 的不生成摘要

## 参考资料                         ← 8. 引用 references/（如有）
如需了解评分规则，阅读 `references/SCORING_RULES.md`。
```

> **关键点**：在 Prompt 中引用 `scripts/`、`references/`、`assets/` 中的文件时使用相对路径，Agent 系统会自动解析到 Skill 目录下的实际文件。

---

## 11. 前端 Skills 管理设计

### 11.1 页面规划

新增 **Skills 管理页面**（`/skills`），包含以下功能区：

```
┌─────────────────────────────────────────────────────────────┐
│  Skills 管理                                      [安装新Skill] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ 分类筛选 ─────────────────────────────────────────────┐  │
│  │ [全部] [内容监控] [数据报告] [个人工具] [自定义]          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                              │
│  ℹ️ 现有功能（每日精选 / GitHub 热点 / 深度分析）             │
│     通过原有入口运行，不在此处管理。                            │
│                                                              │
│  ┌─ Skill 卡片列表 ──────────────────────────────────────┐  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│  │
│  │  │ 📱 微信监控   │  │ 📊 AI 周报   │  │ 🎯 主题追踪  ││  │
│  │  │              │  │              │  │              ││  │
│  │  │ v1.0 · 监控  │  │ v1.0 · 报告  │  │ v1.0 · 监控  ││  │
│  │  │ ✅ 已启用     │  │ ✅ 已启用     │  │ ⏸ 已禁用     ││  │
│  │  │              │  │              │  │              ││  │
│  │  │ 上次执行:    │  │ 上次执行:    │  │              ││  │
│  │  │ 今天 10:00   │  │ 周一 09:00   │  │              ││  │
│  │  │              │  │              │  │              ││  │
│  │  │ [配置] [日志]│  │ [配置] [日志]│  │ [启用] [编辑]││  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘│  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐                   │  │
│  │  │ 📝 阅读笔记  │  │ ➕ 创建Skill │                   │  │
│  │  │              │  │              │                   │  │
│  │  │ v1.0 · 个人  │  │   点击创建   │                   │  │
│  │  │ ✅ 已启用     │  │  你自己的    │                   │  │
│  │  │              │  │   Skill      │                   │  │
│  │  │ [执行] [日志]│  │              │                   │  │
│  │  └──────────────┘  └──────────────┘                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 Skill 配置面板

点击 Skill 卡片的"配置"按钮后展开：

```
┌──────────────────────────────────────────────────────────┐
│  📱 微信公众号监控 — 配置                          [保存]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  基本设置                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  检查间隔（小时）: [2  ▼]                         │   │
│  │  单次最多处理文章数: [20  ▼]                      │   │
│  │  发现新文章时推送通知: [✅]                       │   │
│  │  推送最低评分: [60  ▼]                            │   │
│  │  摘要风格:       [简洁 ▼]  (简洁/详细)             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  触发设置                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  触发方式: [定时 ▼]                               │   │
│  │  执行计划: 每 2 小时 (cron: 0 */2 * * *)          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  高级设置                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  最大循环步数: [20]                               │   │
│  │  超时时间(秒): [240]                              │   │
│  │  温度参数:     [0.3]                              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [查看 Prompt] [查看工具列表] [执行历史]                   │
└──────────────────────────────────────────────────────────┘
```

### 11.3 Skill 执行日志

```
┌──────────────────────────────────────────────────────────┐
│  📱 微信公众号监控 — 执行日志                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🟢 2026-03-28 10:00:03  成功                            │
│  ├─ Step 1: get_user_profile → 获取用户画像              │
│  ├─ Step 2: get_user_sources → 5 个微信公众号            │
│  ├─ Step 3-7: fetch_wechat_articles × 5 → 32 篇文章    │
│  ├─ Step 8: filter_content → 去重后剩 12 篇新文章        │
│  ├─ Step 9: batch_score_contents → 评分完成              │
│  ├─ Step 10-12: generate_summary × 3 → 摘要生成         │
│  ├─ Step 13: save_content → 保存 3 篇高价值文章          │
│  ├─ Step 14: send_daily_digest → ✅ 通知已发送           │
│  └─ Step 15: save_memory → 记录监控结果                  │
│  总耗时: 38s | Token: 9,240 | 步骤: 15/20              │
│                                                          │
│  🟡 2026-03-28 08:00:02  完成（无新内容）                 │
│  ├─ Step 1-7: 采集完成                                   │
│  └─ Step 8: filter_content → 无新文章，跳过推送          │
│  总耗时: 22s | Token: 4,100 | 步骤: 8/20               │
│                                                          │
│  🔴 2026-03-27 16:00:01  失败                            │
│  ├─ Step 1-3: 正常                                       │
│  └─ Step 4: fetch_wechat_articles → ❌ 超时              │
│  错误: 微信接口响应超时                                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 11.4 前端类型扩展

需要在 `frontend/src/types/index.ts` 中新增的类型：

```typescript
// Skill 相关类型定义

interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  tags: string[];
  category: string;
  builtin: boolean;
  status: 'enabled' | 'disabled' | 'error';
  trigger: SkillTrigger;
  settings: SkillSetting[];
  lastExecutedAt?: string;
  executionCount: number;
  successRate: number;
}

interface SkillTrigger {
  type: 'schedule' | 'manual' | 'event' | 'keyword';
  schedule?: { source: string; field: string; cron?: string };
  manual?: { api: boolean; ui: boolean };
  event?: { listen: string; condition: string };
  keyword?: { patterns: string[] };
}

interface SkillSetting {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  value: any;
  default: any;
  options?: { value: string; label: string }[];
}

interface SkillExecution {
  id: string;
  skillId: string;
  userId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt?: string;
  steps: SkillExecutionStep[];
  totalTokens: number;
  error?: string;
}

interface SkillExecutionStep {
  index: number;
  toolName: string;
  description: string;
  status: 'success' | 'failed';
  duration: number;
}
```

---

## 12. 数据库扩展

### 12.1 新增实体

需要新增两张表来支持 Skills 的运行时状态管理：

#### skill_configs 表（Skill 用户配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT | 主键 |
| user_id | VARCHAR(36) | 用户 ID |
| skill_id | VARCHAR(64) | Skill 标识（对应 SKILL.md frontmatter 的 id） |
| status | ENUM('enabled','disabled') | 启用状态 |
| settings | JSON | 用户自定义的配置项 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**说明**：Skill 的定义（SKILL.md + scripts/ + references/ + assets/）存储在文件系统中（`skills/` 目录），此表只存储运行时状态和用户的个性化配置。

#### skill_executions 表（Skill 执行记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT | 主键 |
| skill_id | VARCHAR(64) | Skill 标识 |
| user_id | VARCHAR(36) | 用户 ID |
| session_id | VARCHAR(36) | Agent 会话 ID（关联 agent_logs） |
| status | ENUM('running','success','failed') | 执行状态 |
| input_params | JSON | 输入参数 |
| output_data | JSON | 输出结果 |
| steps_count | INT | 总步骤数 |
| total_tokens | INT | 消耗 Token 数 |
| duration_ms | INT | 执行耗时（毫秒） |
| error_message | TEXT | 错误信息（失败时） |
| started_at | TIMESTAMP | 开始时间 |
| completed_at | TIMESTAMP | 完成时间 |

### 12.2 与现有表的关系

```
skill_configs (新增)                 skills/ 目录 (文件系统)
    │                                     │
    │ skill_id ──────────────────── SKILL.md frontmatter 的 id
    │                                     │
    │                                     │
skill_executions (新增)                   │
    │                                     │
    │ session_id ──── agent_logs (现有)    │
    │                                     │
    │ user_id ──────── users (现有)        │
```

**设计原则**：Skill 的定义（SKILL.md + scripts/ + references/ + assets/）保持文件系统存储，方便 Git 版本管理和人工编辑；只有运行时数据（状态、配置、执行记录）存入数据库。

---

## 13. 安全与治理

### 13.1 Skill 权限模型

```yaml
# 权限等级
permissions:
  level_1_read:        # 只读操作
    - "get_user_profile"
    - "get_user_sources"
    - "query_memory"

  level_2_process:     # 数据处理
    - "filter_content"
    - "score_content"
    - "generate_summary"

  level_3_write:       # 写入操作
    - "save_content"
    - "create_digest"
    - "save_memory"

  level_4_notify:      # 外部通知（最敏感）
    - "send_daily_digest"
    - "send_github_digest"
```

### 13.2 安全规则

| # | 规则 | 说明 |
|---|------|------|
| 1 | **官方 Skill 可信** | 由项目组维护的官方 Skill 拥有所有权限 |
| 2 | **第三方 Skill 受限** | 用户自建或社区安装的 Skill 默认只有 level_1 + level_2 权限 |
| 3 | **推送权限需审批** | Skill 如需调用推送工具（level_4），需要用户明确授权 |
| 4 | **Prompt 注入防护** | Skill 的变量插值必须经过转义，防止 Prompt 注入攻击 |
| 5 | **执行频率限制** | 每个 Skill 每用户每小时最多执行 N 次（可配置） |
| 6 | **Token 预算** | 每个 Skill 有 Token 预算上限，超出自动终止 |
| 7 | **Frontmatter 校验** | Skill 加载时 SKILL.md 的 frontmatter 必须通过 Schema 校验，格式不合法拒绝加载 |

### 13.3 Skill 审计日志

所有 Skill 的安装、启用、禁用、执行、配置变更都记录审计日志，便于追溯：

```
[2026-03-28 10:00:01] SKILL_EXECUTE  skill=wechat-monitor user=user-001 status=started
[2026-03-28 10:00:38] SKILL_EXECUTE  skill=wechat-monitor user=user-001 status=success steps=15 tokens=9240
[2026-03-28 14:15:00] SKILL_CONFIG   skill=wechat-monitor user=user-001 action=update_settings
[2026-03-28 15:00:00] SKILL_INSTALL  skill=topic-tracker user=user-001 version=1.0.0
```

---

## 14. 实施路线图

### Phase 1：基础设施（1-2 周）

```
目标：搭建 Skills 运行框架，实现首个新 Skill（微信监控）

┌─────────────────────────────────────────────────────────┐
│ 后端                                                     │
│ □ 1.1 定义 Skill 类型系统（TypeScript 接口）              │
│ □ 1.2 实现 SKILL.md 解析器（frontmatter + Markdown 拆分）│
│ □ 1.3 实现 SkillRegistry（发现、加载、校验、注册）         │
│ □ 1.4 实现 SkillExecutor（Prompt 组装、references 加载、  │
│       scripts 执行、工具筛选、配置构建）                    │
│ □ 1.5 在 AgentService 中新增 runSkill() 方法             │
│ □ 1.6 新增 SkillController（CRUD + 执行 API）            │
│ □ 1.7 新增 skill_configs 和 skill_executions 数据库实体  │
│ □ 1.8 实现 Prompt 模板引擎（变量插值）                    │
│ □ 1.9 实现 scripts/ 沙箱执行器（生命周期钩子 + 自定义脚本）│
│                                                          │
│ Skill 文件                                               │
│ □ 1.10 编写 wechat-monitor Skill                         │
│      （SKILL.md + scripts/ + references/）                │
│ □ 1.11 编写 _template 模板                               │
│                                                          │
│ 注意                                                     │
│ ⚠ 现有的 runDailyDigest / runGithubTrending /            │
│   runAnalysisOnly 完全不动，Skills 是独立的新通道          │
│                                                          │
│ 验证                                                     │
│ □ 1.12 wechat-monitor Skill 端到端测试                   │
│ □ 1.13 确认 Skill 执行不影响现有 3 种模式的正常运行        │
└─────────────────────────────────────────────────────────┘
```

### Phase 2：前端管理 + 更多 Skill（1-2 周）

```
┌─────────────────────────────────────────────────────────┐
│ 前端                                                     │
│ □ 2.1 新增 Skills 管理页面（路由 /skills）                │
│ □ 2.2 实现 Skill 卡片列表组件                             │
│ □ 2.3 实现 Skill 配置面板（settings 动态表单）            │
│ □ 2.4 实现 Skill 执行日志查看                             │
│ □ 2.5 新增 useSkillStore（Zustand）                      │
│ □ 2.6 实现手动触发 Skill 的 UI 按钮                       │
│ □ 2.7 页面中明确区分"现有功能"和"Skills 扩展"              │
│                                                          │
│ 新增 Skill                                               │
│ □ 2.8 编写 weekly-report Skill（AI 周报）                │
│ □ 2.9 编写 topic-tracker Skill（主题追踪）               │
│ □ 2.10 编写 reading-digest Skill（阅读笔记）             │
│                                                          │
│ API 对接                                                 │
│ □ 2.11 Skills API 接口封装（api/skills.ts）              │
│ □ 2.12 前端类型定义（types/index.ts 扩展）                │
└─────────────────────────────────────────────────────────┘
```

### Phase 3：高级特性（2-3 周）

```
┌─────────────────────────────────────────────────────────┐
│ □ 3.1 Skill 热重载（文件变更监听 → 自动重载）             │
│ □ 3.2 自定义 Skill 创建向导（前端可视化创建）             │
│ □ 3.3 事件触发机制（EventEmitter + Skill Resolver）      │
│ □ 3.4 关键词触发机制（用户输入 → 自动匹配 Skill）         │
│ □ 3.5 Skill 权限管理和安全审计                            │
│ □ 3.6 Skill 之间的依赖和编排（组合 Skill）                │
│ □ 3.7 Skill 执行统计和分析面板                            │
│ □ 3.8 Skill 导入/导出功能                                │
└─────────────────────────────────────────────────────────┘
```

### Phase 4：生态与扩展（远期）

```
┌─────────────────────────────────────────────────────────┐
│ □ 4.1 Skill 市场（社区共享 Skill）                       │
│ □ 4.2 Skill 版本管理和自动更新                            │
│ □ 4.3 MCP 协议集成（支持通过 MCP 发现和加载远程 Tool）    │
│ □ 4.4 Skill 评分和推荐系统                               │
│ □ 4.5 低代码 Skill 编辑器（可视化编排 Prompt 和工具）     │
└─────────────────────────────────────────────────────────┘
```

---

## 附录

### A. 新增 API 端点规划

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/skills` | 列出所有 Skill |
| GET | `/api/skills/:id` | 获取 Skill 详情（含 SKILL.md 解析结果） |
| POST | `/api/skills/:id/execute` | 手动执行 Skill |
| PUT | `/api/skills/:id/config` | 更新 Skill 用户配置 |
| PUT | `/api/skills/:id/status` | 启用/禁用 Skill |
| GET | `/api/skills/:id/executions` | 获取 Skill 执行历史 |
| GET | `/api/skills/:id/executions/:eid` | 获取单次执行详情 |
| POST | `/api/skills/install` | 安装新 Skill（上传 zip 或 Git URL） |
| DELETE | `/api/skills/:id` | 卸载自定义 Skill |
| POST | `/api/skills/validate` | 验证 SKILL.md frontmatter 格式 |
| POST | `/api/skills/:id/reload` | 热重载 Skill |

### B. SKILL.md Frontmatter JSON Schema（用于校验）

> 对标 CodeBuddy / Cursor / Claude Code 标准，frontmatter 只需要 `name` 和 `description` 两个必需字段。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SKILL.md Frontmatter Schema",
  "type": "object",
  "required": ["name", "description"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "技能标识名，只允许小写字母、数字和连字符"
    },
    "description": {
      "type": "string",
      "minLength": 10,
      "description": "技能描述——AI 根据此描述决定是否触发技能，应包含功能说明和典型触发场景"
    }
  },
  "additionalProperties": false
}
```

> **注意**：Markdown 正文部分（frontmatter 之后的内容）不需要 Schema 校验，它是自由格式的 Agent 指令。所有工具列表、执行步骤、参数说明等都写在正文中。

### C. 新增组件与现有文件的关系速查表

| 新增组件 | 关联的现有文件 | 关系 |
|----------|--------------|------|
| SkillRegistry | `agent-tool-registry.ts` | 新注册表，解析 SKILL.md frontmatter，引用 ToolRegistry 中的工具名称 |
| SkillExecutor | `agent.service.ts` | 解析 SKILL.md + 加载 scripts/references → 组装 config 传给 `runAgentLoop()` |
| runSkill() | `agent.service.ts` | 新增方法，与现有 runDailyDigest 等方法并列 |
| SkillController | `agent.controller.ts` | 新控制器，复用 Agent 执行能力 |
| SkillModule | `agent.module.ts` | 新模块，导入 AgentModule |
| SkillConfigEntity | `common/database/entities/` | 新实体 |
| SkillExecutionEntity | `common/database/entities/` | 新实体 |
| `skills/` 目录 | 无（全新） | 独立于现有代码的 Skill 定义目录（SKILL.md + scripts/ + references/ + assets/） |

> **关键原则**：所有新增组件都是增量添加，不修改、不替换任何现有文件中的逻辑。

### D. 术语表

| 术语 | 定义 |
|------|------|
| **Skill** | 对 Agent 特定领域能力的标准化封装，包含 SKILL.md（Prompt + 元数据）、scripts/、references/、assets/ |
| **SKILL.md** | Skill 的唯一必需文件，YAML frontmatter（结构化元数据）+ Markdown 正文（Agent Prompt 指令） |
| **Frontmatter** | SKILL.md 文件开头用 `---` 包裹的 YAML 部分，包含 id、trigger、tools、agent 等结构化配置 |
| **scripts/** | Skill 目录下的可执行脚本文件夹，存放确定性的预处理/后处理逻辑（TS/Python/Shell） |
| **references/** | Skill 目录下的参考资料文件夹，存放领域文档、API 规范等，支持预加载/按需加载到 Agent 上下文 |
| **assets/** | Skill 目录下的静态资产文件夹，存放模板文件、配置模板等，供 Agent 生成输出时引用 |
| **Tool** | Agent 可调用的单个函数（如 `fetch_rss_content`），由 `AgentToolRegistry` 管理 |
| **Agent Loop** | Agent 的核心执行循环：LLM 推理 → 工具调用 → 结果回传 → 再次推理 |
| **SkillRegistry** | Skill 的注册表，负责发现、加载、解析 SKILL.md、校验、匹配 Skill |
| **SkillExecutor** | Skill 的执行器，负责将 SKILL.md 解析结果 + scripts/ + references/ 转换为 Agent Loop 可执行的配置 |
| **Trigger** | Skill 的触发条件（在 frontmatter 中定义），决定"什么时候应该激活这个 Skill" |
| **Settings** | Skill 暴露给用户的可配置项（在 frontmatter 中定义），通过前端 UI 动态调整 |

---

> **文档结束** | 如有疑问请联系项目组讨论
